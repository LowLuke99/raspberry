use serde::Serialize;
use std::net::{Ipv4Addr, UdpSocket};
use std::process::Command;

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
}

/// Discover LAN devices from the OS ARP cache (`arp -a`). Skips multicast /
/// broadcast rows. Latency and mDNS agent detection come in later phases.
pub fn scan_lan() -> Vec<LanDevice> {
    let Ok(out) = Command::new("arp").arg("-a").output() else {
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
        // skip multicast (224-239), broadcast (255), and the all-ones MAC
        let first = ip.octets()[0];
        if (224..=239).contains(&first) || first == 255 || ip.octets()[3] == 255 {
            continue;
        }
        if mac_raw.to_lowercase().starts_with("ff-ff") {
            continue;
        }

        let mac = mac_raw.replace('-', ":").to_lowercase();
        devices.push(LanDevice {
            vendor: oui_vendor(&mac),
            kind: parts.get(2).copied().unwrap_or("dynamic").to_string(),
            ip: ip.to_string(),
            mac,
        });
    }
    devices
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

/// Minimal built-in OUI lookup for common vendors. A full OUI database is a
/// later enhancement; unknown prefixes return "Unknown".
fn oui_vendor(mac: &str) -> String {
    let prefix: String = mac.chars().take(8).collect(); // "aa:bb:cc"
    match prefix.as_str() {
        "00:1a:11" | "3c:5a:b4" | "f4:f5:e8" => "Google",
        "b8:27:eb" | "dc:a6:32" | "e4:5f:01" => "Raspberry Pi",
        "00:0c:29" | "00:50:56" => "VMware",
        "00:15:5d" => "Microsoft (Hyper-V)",
        "ac:de:48" | "f0:18:98" | "a4:83:e7" => "Apple",
        "00:1d:d8" | "00:03:ff" => "Microsoft",
        _ => "Unknown",
    }
    .to_string()
}
