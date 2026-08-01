use serde::Serialize;
use std::net::{Ipv4Addr, UdpSocket};
use std::process::Command;
use std::sync::mpsc;
use std::thread;

/// Windows CREATE_NO_WINDOW — the missing flag that lets a Tauri release exe
/// (GUI subsystem) spawn console tools like ping / arp WITHOUT flashing a new
/// console window per child. Without this, a /24 deep scan opens dozens of
/// black cmd windows because there's no parent console for the child to
/// inherit.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Build a `Command` for a console tool that never shows a window on Windows.
/// On other platforms this is just `Command::new(program)`.
fn hidden_command(program: &str) -> Command {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = Command::new(program);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new(program)
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct NetInterface {
    pub name: String,
    pub friendly: String,
    pub mac: Option<String>,
    pub ipv4: Vec<String>,
    pub is_up: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct NetworkInfo {
    pub interfaces: Vec<NetInterface>,
    pub local_ip: Option<String>,
    pub gateway_ip: Option<String>,
    pub gateway_mac: Option<String>,
}

/// Local interfaces (name, MAC, IPv4s) plus the default route's gateway.
pub fn network_info() -> NetworkInfo {
    let interfaces = netdev::get_interfaces()
        .into_iter()
        .map(|i| {
            let ipv4: Vec<String> = i.ipv4.iter().map(|n| n.addr.to_string()).collect();
            NetInterface {
                friendly: i.friendly_name.clone().unwrap_or_else(|| i.name.clone()),
                is_up: !ipv4.is_empty(),
                name: i.name,
                mac: i.mac_addr.map(|m| m.to_string()),
                ipv4,
            }
        })
        .collect();

    let default = netdev::get_default_interface().ok();
    let local_ip = default
        .as_ref()
        .and_then(|d| d.ipv4.first().map(|n| n.addr.to_string()));
    let gateway = default.as_ref().and_then(|d| d.gateway.as_ref());
    let gateway_ip = gateway.and_then(|g| g.ipv4.first().map(|a| a.to_string()));
    let gateway_mac = gateway.map(|g| g.mac_addr.to_string());

    NetworkInfo {
        interfaces,
        local_ip,
        gateway_ip,
        gateway_mac,
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct LanDevice {
    pub ip: String,
    pub mac: String,
    pub vendor: String,
    pub kind: String,
    /// Reverse-DNS / NetBIOS name if `ping -a` resolved one. Only populated by
    /// `scan_lan_deep`; the fast ARP-only scan leaves this None.
    pub hostname: Option<String>,
    /// Round-trip time in ms from the deep-scan ping. None for fast scan.
    pub latency_ms: Option<u32>,
}

/// Fast scan: read the OS ARP cache (`arp -a`). Only shows hosts Windows has
/// spoken to recently, so counts are usually low — use `scan_lan_deep` to
/// actively discover everything on the /24.
pub fn scan_lan() -> Vec<LanDevice> {
    read_arp_cache()
}

/// Deep scan: parallel-ping every host on the local /24, which primes the ARP
/// table for anything that answers, then re-reads ARP and enriches each entry
/// with reverse-DNS hostname + latency captured from ping.
///
/// Windows `ping -a -n 1 -w 250 <ip>` both resolves the hostname and prints
/// the RTT, so one process per host does everything at once. Concurrency is
/// capped to keep the process count sane on shared machines.
pub fn scan_lan_deep() -> Vec<LanDevice> {
    let Some(default) = netdev::get_default_interface().ok() else {
        return scan_lan();
    };
    let Some(local) = default.ipv4.first().map(|n| n.addr) else {
        return scan_lan();
    };
    let octets = local.octets();

    // Sweep the /24 the machine sits on. Skip .0 (network), .255 (broadcast),
    // and our own IP (already known).
    let mut hosts: Vec<Ipv4Addr> = Vec::with_capacity(253);
    for h in 1u8..=254 {
        let ip = Ipv4Addr::new(octets[0], octets[1], octets[2], h);
        if ip != local {
            hosts.push(ip);
        }
    }

    // Bounded worker pool. 16 concurrent pings finishes a /24 in ~2-4s and
    // keeps the process count low enough that Windows never runs out of
    // console-attach slots even under load.
    const WORKERS: usize = 16;
    let (tx, rx) = mpsc::channel::<(String, Option<String>, Option<u32>)>();
    let chunk_size = hosts.len().div_ceil(WORKERS);
    let mut handles = Vec::with_capacity(WORKERS);
    for chunk in hosts.chunks(chunk_size) {
        let ips: Vec<Ipv4Addr> = chunk.to_vec();
        let tx = tx.clone();
        handles.push(thread::spawn(move || {
            for ip in ips {
                let (host, ms) = probe_host(ip);
                let _ = tx.send((ip.to_string(), host, ms));
            }
        }));
    }
    drop(tx);
    let mut probed: std::collections::HashMap<String, (Option<String>, Option<u32>)> =
        std::collections::HashMap::new();
    while let Ok((ip, host, ms)) = rx.recv() {
        probed.insert(ip, (host, ms));
    }
    for h in handles {
        let _ = h.join();
    }

    let mut devices = read_arp_cache();
    for d in devices.iter_mut() {
        if let Some((host, ms)) = probed.remove(&d.ip) {
            d.hostname = host;
            d.latency_ms = ms;
        }
    }
    devices.sort_by(|a, b| ip_sort_key(&a.ip).cmp(&ip_sort_key(&b.ip)));
    devices
}

/// Parse `arp -a` into `LanDevice` rows, skipping multicast / broadcast noise.
fn read_arp_cache() -> Vec<LanDevice> {
    let Ok(out) = hidden_command("arp").arg("-a").output() else {
        return Vec::new();
    };
    let text = String::from_utf8_lossy(&out.stdout);

    let mut devices = Vec::new();
    for line in text.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }
        let Ok(ip) = parts[0].parse::<Ipv4Addr>() else {
            continue;
        };
        let mac_raw = parts[1];
        if !mac_raw.contains('-') && !mac_raw.contains(':') {
            continue;
        }
        // skip multicast (224-239) and broadcast (.255)
        let first = ip.octets()[0];
        if (224..=239).contains(&first) || ip.octets()[3] == 255 {
            continue;
        }
        if mac_raw.to_lowercase().starts_with("ff-ff") {
            continue;
        }

        let mac = mac_raw.replace('-', ":").to_lowercase();
        devices.push(LanDevice {
            vendor: oui_vendor(&mac).to_string(),
            kind: parts.get(2).copied().unwrap_or("dynamic").to_string(),
            ip: ip.to_string(),
            mac,
            hostname: None,
            latency_ms: None,
        });
    }
    devices
}

/// One Windows ping: resolves hostname (`-a`), 1 echo (`-n 1`), 250ms timeout
/// (`-w 250`). Parses the output for the resolved name and RTT.
fn probe_host(ip: Ipv4Addr) -> (Option<String>, Option<u32>) {
    let ip_s = ip.to_string();
    let out = hidden_command("ping")
        .args(["-a", "-n", "1", "-w", "250", &ip_s])
        .output();
    let Ok(out) = out else {
        return (None, None);
    };
    // ping's stdout uses the system codepage; UTF-8 lossy is fine for our
    // ASCII-only tokens.
    let text = String::from_utf8_lossy(&out.stdout);

    let mut hostname: Option<String> = None;
    let mut latency: Option<u32> = None;

    for line in text.lines() {
        let l = line.trim();

        // "Pinging HOSTNAME [1.2.3.4] with 32 bytes of data:"
        //     → keep HOSTNAME only if it isn't a bare IP echo.
        if hostname.is_none() {
            if let Some(rest) = l.strip_prefix("Pinging ") {
                if let Some(bracket) = rest.find('[') {
                    let name = rest[..bracket].trim().trim_end_matches('.').to_string();
                    if !name.is_empty() && name != ip_s {
                        hostname = Some(name);
                    }
                }
            }
        }

        // "Reply from 1.2.3.4: bytes=32 time=1ms TTL=128"  (or "time<1ms")
        if latency.is_none() && l.starts_with("Reply from") {
            if let Some(idx) = l.find("time") {
                let tail = &l[idx + 4..];
                let (op, rest) = if let Some(rest) = tail.strip_prefix('<') {
                    ('<', rest)
                } else if let Some(rest) = tail.strip_prefix('=') {
                    ('=', rest)
                } else {
                    ('=', tail)
                };
                let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                if let Ok(n) = digits.parse::<u32>() {
                    latency = Some(if op == '<' { 0 } else { n });
                }
            }
        }
    }

    // "Reply from" absent means the host didn't answer within the timeout.
    (hostname, latency)
}

/// Sort key so 10.0.0.9 comes before 10.0.0.10 (string sort would flip them).
fn ip_sort_key(s: &str) -> (u8, u8, u8, u8) {
    let ip: Ipv4Addr = s.parse().unwrap_or(Ipv4Addr::UNSPECIFIED);
    let o = ip.octets();
    (o[0], o[1], o[2], o[3])
}

/// Send a Wake-on-LAN magic packet to a MAC over the broadcast address.
pub fn wake_on_lan(mac: &str) -> Result<(), String> {
    let bytes = parse_mac(mac)?;
    let mut packet = vec![0xFFu8; 6];
    for _ in 0..16 {
        packet.extend_from_slice(&bytes);
    }
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.set_broadcast(true).map_err(|e| e.to_string())?;
    socket
        .send_to(&packet, "255.255.255.255:9")
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_mac(mac: &str) -> Result<[u8; 6], String> {
    let parts: Vec<&str> = mac.split([':', '-']).collect();
    if parts.len() != 6 {
        return Err(format!("invalid MAC: {mac}"));
    }
    let mut out = [0u8; 6];
    for (i, p) in parts.iter().enumerate() {
        out[i] = u8::from_str_radix(p, 16).map_err(|_| format!("invalid MAC byte: {p}"))?;
    }
    Ok(out)
}

/// Curated OUI lookup for the vendors most likely to show up on a home / SMB
/// LAN. A full IEEE OUI DB is a later enhancement; unknown prefixes return
/// "Unknown". Prefix format is lowercase "aa:bb:cc".
fn oui_vendor(mac: &str) -> &'static str {
    let prefix: String = mac.chars().take(8).collect();
    match prefix.as_str() {
        // Google / Nest
        "00:1a:11" | "3c:5a:b4" | "f4:f5:e8" | "f4:f5:d8" | "f4:f5:db" | "18:b4:30"
        | "6c:ad:f8" | "1c:f2:9a" | "20:df:b9" | "d8:6c:63" | "48:d6:d5" | "a4:77:33"
        | "94:eb:2c" | "54:60:09" => "Google / Nest",

        // Raspberry Pi Foundation
        "b8:27:eb" | "dc:a6:32" | "e4:5f:01" | "28:cd:c1" | "2c:cf:67" | "d8:3a:dd" => "Raspberry Pi",

        // Apple
        "ac:de:48" | "f0:18:98" | "a4:83:e7" | "3c:22:fb" | "a8:5c:2c" | "88:66:5a"
        | "a4:d1:8c" | "b8:e8:56" | "d0:d2:b0" | "60:03:08" | "68:5b:35" | "a0:99:9b"
        | "70:70:0d" | "6c:40:08" | "b8:53:ac" | "88:e9:fe" | "e0:33:8e" | "50:ed:3c" => "Apple",

        // Microsoft (Hyper-V + Xbox/Surface)
        "00:15:5d" => "Microsoft (Hyper-V)",
        "00:1d:d8" | "00:03:ff" | "00:22:48" | "28:18:78" | "58:82:a8" | "7c:1e:52"
        | "9c:aa:1b" | "60:45:bd" | "50:1a:c5" | "98:5f:d3" | "b8:31:b5" => "Microsoft",

        // Amazon (Echo, Fire TV, Ring)
        "0c:47:c9" | "18:74:2e" | "34:d2:70" | "40:b4:cd" | "44:65:0d" | "50:dc:e7"
        | "68:37:e9" | "74:c2:46" | "78:e1:03" | "84:d6:d0" | "88:71:e5" | "a0:02:dc"
        | "ac:63:be" | "b0:47:bf" | "cc:9e:a2" | "fc:65:de" | "fc:a1:83" => "Amazon",

        // Samsung
        "00:07:ab" | "00:12:47" | "00:12:fb" | "00:15:99" | "00:1a:8a" | "00:1d:f6"
        | "00:1e:7d" | "00:21:19" | "00:23:39" | "20:64:32" | "34:23:87" | "5c:0a:5b"
        | "5c:e8:eb" | "70:f9:27" | "78:1f:db" | "88:32:9b" | "a0:0b:ba" | "b4:79:a7"
        | "cc:07:ab" | "d0:87:e2" | "e8:50:8b" | "fc:a1:3e" => "Samsung",

        // Sony (PlayStation, Bravia)
        "00:04:1f" | "00:13:15" | "00:19:c5" | "00:1a:80" | "00:1d:0d" | "28:0d:fc"
        | "70:26:05" | "9c:03:75" | "bc:60:a7" | "d4:4b:5e" | "fc:0f:e6" => "Sony / PlayStation",

        // Nintendo
        "00:09:bf" | "00:16:56" | "00:17:ab" | "00:19:1d" | "00:19:fd" | "00:1a:e9"
        | "04:03:d6" | "34:af:2c" | "58:2f:40" | "8c:cd:e8" | "e0:0c:7f" => "Nintendo",

        // Roku
        "08:05:81" | "0c:db:a7" | "20:ef:bd" | "b0:a7:37" | "b8:3e:59" | "c8:3a:6b"
        | "cc:6d:a0" | "d4:4b:6a" | "d8:31:34" => "Roku",

        // Sonos
        "00:0e:58" | "5c:aa:fd" | "78:28:ca" | "94:9f:3e" | "b8:e9:37" | "c0:56:27"
        | "e0:37:17" => "Sonos",

        // Hypervisors + virt
        "00:0c:29" | "00:50:56" => "VMware",
        "00:1c:42" => "Parallels",
        "08:00:27" => "VirtualBox",

        // NAS
        "00:11:32" | "00:03:2f" | "00:24:a5" | "00:80:77" => "Synology / NAS",

        // Routers / APs
        "00:1d:aa" | "00:24:73" | "68:ff:7b" | "94:9a:a9" | "44:d1:fa" | "d4:6e:0e"
        | "e4:c3:2a" => "TP-Link",
        "00:14:6c" | "20:e5:2a" | "84:1b:5e" | "9c:d3:6d" | "c0:3f:0e" | "cc:40:d0"
        | "18:e8:29" | "2c:c8:1b" | "40:16:7e" | "4c:5e:0c" | "50:eb:f6" | "70:8b:cd"
        | "88:d7:f6" | "9c:9d:7e" | "c8:14:79" | "d0:17:c2" | "d4:5d:df" | "ec:1a:59"
        | "f0:2f:74" | "f4:f2:6d" => "Netgear",
        "00:1a:1e" | "20:aa:4b" | "68:7f:74" | "a0:ce:c8" | "e8:9f:80" => "Cisco / Linksys",
        "10:7b:44" | "1c:87:2c" | "24:65:11" | "50:c7:bf" | "74:d0:2b" | "60:38:e0"
        | "70:4d:7b" => "ASUS",
        "00:26:5a" | "3c:df:a9" | "78:d2:94" | "88:9f:fa" | "b8:98:37" | "d8:eb:97"
        | "e8:cc:18" => "D-Link",

        // Ubiquiti
        "00:15:6d" | "24:a4:3c" | "44:d9:e7" | "68:72:51" | "74:83:c2" | "78:8a:20"
        | "80:2a:a8" | "b4:fb:e4" | "dc:9f:db" | "e0:63:da" | "f0:9f:c2" | "fc:ec:da" => "Ubiquiti",

        // Intel (Wi-Fi cards + NUCs)
        "00:1c:c0" | "00:15:00" | "00:1b:21" | "00:24:d7" | "34:13:e8" | "3c:a9:f4"
        | "60:6c:66" | "68:07:15" | "74:e5:0b" | "7c:5c:f8" | "8c:70:5a" | "94:65:9c"
        | "a0:88:69" | "a4:34:d9" | "ac:2b:6e" | "b4:6d:83" | "c0:3f:d5" | "d0:53:49"
        | "dc:53:60" | "e4:b3:18" | "f8:16:54" => "Intel",

        // Realtek
        "00:e0:4c" => "Realtek",

        _ => "Unknown",
    }
}
