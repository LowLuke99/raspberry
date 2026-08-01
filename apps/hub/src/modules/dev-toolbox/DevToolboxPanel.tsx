import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import QRCode from "qrcode";
import {
  Copy,
  Check,
  RefreshCw,
  Wifi,
  Radar,
  KeyRound,
  QrCode as QrIcon,
  Loader2,
  Fingerprint,
  Clock,
  type LucideIcon,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";

type Tool = "port" | "password" | "qr" | "wifi" | "uuid" | "time";
const TOOLS: { key: Tool; label: string; icon: LucideIcon }[] = [
  { key: "port", label: "Port Check", icon: Radar },
  { key: "password", label: "Password", icon: KeyRound },
  { key: "qr", label: "QR", icon: QrIcon },
  { key: "wifi", label: "WiFi QR", icon: Wifi },
  { key: "uuid", label: "UUID", icon: Fingerprint },
  { key: "time", label: "Timestamp", icon: Clock },
];

/**
 * Toolbox — practical utilities aimed at running a machine on your LAN, not
 * generic dev-editor tools. Each tab does one small thing well and offline.
 */
export function DevToolboxPanel({ manifest }: { manifest: ModuleManifest }) {
  const [tool, setTool] = useState<Tool>("port");
  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-1 rounded-[9px] bg-surface p-0.5 shadow-[var(--hairline)]">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTool(t.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[11px] transition-colors",
                  tool === t.key ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
                )}
              >
                <Icon size={12} />
                {t.label}
              </button>
            );
          })}
        </div>
      }
    >
      {tool === "port" && <PortCheckTool />}
      {tool === "password" && <PasswordTool />}
      {tool === "qr" && <QrTool />}
      {tool === "wifi" && <WifiQrTool />}
      {tool === "uuid" && <UuidTool />}
      {tool === "time" && <TimeTool />}
    </PanelShell>
  );
}

/* ── shared bits ─────────────────────────────────────────────── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="focus-ring flex items-center gap-1.5 rounded-[8px] bg-surface-hi px-2.5 py-1 text-[11px] text-text-dim transition-colors hover:text-text disabled:opacity-40"
    >
      {copied ? <Check size={12} className="text-raspberry" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-2">
        <span className="text-[11px] uppercase tracking-wide text-text-dim">{label}</span>
        {hint && <span className="text-[10.5px] text-text-dim/70">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "mono h-9 w-full rounded-[10px] bg-[rgba(0,0,0,0.25)] px-3 text-[13px] text-text shadow-[var(--hairline)] focus:outline-none focus:shadow-[var(--hairline),0_0_0_2px_rgba(225,29,72,0.4)]";

/* ── Port Check ──────────────────────────────────────────────── */

interface PortCheckResult {
  host: string;
  port: number;
  open: boolean;
  latency_ms: number | null;
  error: string | null;
}

const COMMON_PORTS: { port: number; label: string }[] = [
  { port: 22, label: "SSH" },
  { port: 80, label: "HTTP" },
  { port: 443, label: "HTTPS" },
  { port: 3389, label: "RDP" },
  { port: 5900, label: "VNC" },
  { port: 8848, label: "Raspberry Agent" },
];

function PortCheckTool() {
  const [host, setHost] = useState("192.168.1.1");
  const [port, setPort] = useState("443");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PortCheckResult | null>(null);

  async function run(overridePort?: number) {
    const p = overridePort ?? Number(port);
    if (!host.trim() || !Number.isFinite(p) || p < 1 || p > 65535) return;
    if (overridePort !== undefined) setPort(String(overridePort));
    setBusy(true);
    setResult(null);
    try {
      const r = await invoke<PortCheckResult>("port_check", {
        host: host.trim(),
        port: p,
        timeoutMs: 1500,
      });
      setResult(r);
    } catch (e) {
      setResult({
        host: host.trim(),
        port: p,
        open: false,
        latency_ms: null,
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_120px_auto] gap-2">
        <Field label="Host">
          <input
            className={inputCls}
            value={host}
            onChange={(e) => setHost(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="192.168.1.42 or my-nas.local"
            spellCheck={false}
          />
        </Field>
        <Field label="Port">
          <input
            className={inputCls}
            value={port}
            onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && run()}
            inputMode="numeric"
          />
        </Field>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => run()}
            disabled={busy}
            className="focus-ring flex h-9 items-center gap-1.5 rounded-[10px] bg-[rgba(var(--raspberry-rgb),0.2)] px-4 text-[12px] text-raspberry transition-colors hover:bg-[rgba(var(--raspberry-rgb),0.28)] disabled:opacity-40"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Radar size={13} />}
            {busy ? "Probing…" : "Check"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10.5px] uppercase tracking-wide text-text-dim">Common</span>
        {COMMON_PORTS.map((p) => (
          <button
            key={p.port}
            type="button"
            onClick={() => run(p.port)}
            className="focus-ring rounded-full bg-surface-hi px-2.5 py-0.5 text-[11px] text-text-dim transition-colors hover:text-text"
          >
            {p.port} <span className="text-text-dim/70">{p.label}</span>
          </button>
        ))}
      </div>

      {result && (
        <GlassPanel interactive={false} className="p-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "relative flex h-3 w-3",
                "before:absolute before:inset-0 before:rounded-full",
                result.open ? "before:bg-emerald-400" : "before:bg-red-400",
              )}
            />
            <span className="mono text-[14px] text-text">
              {result.host}:{result.port}
            </span>
            <span
              className={cn(
                "mono rounded-full px-2 py-0.5 text-[10.5px] uppercase tracking-wide",
                result.open
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-red-500/15 text-red-300",
              )}
            >
              {result.open ? "open" : "closed"}
            </span>
            {result.latency_ms !== null && (
              <span className="mono ml-auto text-[12px] text-text-dim">
                {result.latency_ms} ms
              </span>
            )}
          </div>
          {result.error && !result.open && (
            <div className="mono mt-2 text-[11px] text-text-dim">{result.error}</div>
          )}
        </GlassPanel>
      )}
    </div>
  );
}

/* ── Password ────────────────────────────────────────────────── */

function PasswordTool() {
  const [length, setLength] = useState(24);
  const [useUpper, setUpper] = useState(true);
  const [useLower, setLower] = useState(true);
  const [useDigits, setDigits] = useState(true);
  const [useSymbols, setSymbols] = useState(true);
  const [pw, setPw] = useState("");

  const alphabet = useMemo(() => {
    let s = "";
    if (useLower) s += "abcdefghijklmnopqrstuvwxyz";
    if (useUpper) s += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (useDigits) s += "0123456789";
    if (useSymbols) s += "!@#$%^&*()-_=+[]{};:,.?~";
    return s;
  }, [useLower, useUpper, useDigits, useSymbols]);

  const generate = () => {
    if (!alphabet) return setPw("");
    const buf = new Uint32Array(length);
    crypto.getRandomValues(buf);
    let out = "";
    for (let i = 0; i < length; i++) {
      // rejection-free enough for a UI password; unbiased for len ≤ 512
      out += alphabet[buf[i]! % alphabet.length];
    }
    setPw(out);
  };

  useEffect(() => {
    generate();
    // regenerate when knobs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, alphabet]);

  // rough entropy estimate: log2(alphabet^length)
  const bits = alphabet.length > 0 ? Math.round(length * Math.log2(alphabet.length)) : 0;
  const strengthColor = bits >= 128 ? "text-emerald-300" : bits >= 80 ? "text-amber-300" : "text-red-300";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={`Length: ${length}`}>
          <input
            type="range"
            min={8}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="accent-[rgb(var(--raspberry-rgb))]"
          />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Toggle label="a-z" value={useLower} onChange={setLower} />
          <Toggle label="A-Z" value={useUpper} onChange={setUpper} />
          <Toggle label="0-9" value={useDigits} onChange={setDigits} />
          <Toggle label="!@#" value={useSymbols} onChange={setSymbols} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={cn("mono flex-1 truncate rounded-[10px] bg-[rgba(0,0,0,0.25)] p-3 text-[14px] text-text shadow-[var(--hairline)]")}>{pw || "—"}</div>
        <button
          type="button"
          onClick={generate}
          className="focus-ring flex h-11 items-center gap-1.5 rounded-[10px] bg-surface-hi px-3 text-[12px] text-text transition-colors hover:text-raspberry"
        >
          <RefreshCw size={13} /> New
        </button>
        <CopyButton text={pw} />
      </div>
      <div className="text-[11px] text-text-dim">
        Entropy: <span className={cn("mono", strengthColor)}>{bits} bits</span>
        <span className="ml-2 text-text-dim/60">
          {bits >= 128 ? "strong" : bits >= 80 ? "ok" : "weak"} · offline, generated with crypto.getRandomValues
        </span>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "mono rounded-[8px] px-2.5 py-1 text-[11px] shadow-[var(--hairline)] transition-colors",
        value ? "bg-[rgba(var(--raspberry-rgb),0.2)] text-raspberry" : "bg-surface text-text-dim hover:text-text",
      )}
    >
      {label}
    </button>
  );
}

/* ── QR (text/URL) ───────────────────────────────────────────── */

function useQrDataUrl(text: string): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    if (!text) {
      setUrl("");
      return;
    }
    QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: { dark: "#f5f5f5", light: "#00000000" },
    })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(""));
    return () => {
      alive = false;
    };
  }, [text]);
  return url;
}

function QrTool() {
  const [text, setText] = useState("https://github.com/LowLuke99/raspberry");
  const url = useQrDataUrl(text);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
      <Field label="Text or URL" hint="anything — a URL, a note, a config">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="mono min-h-[240px] w-full resize-y rounded-[10px] bg-[rgba(0,0,0,0.25)] p-3 text-[13px] text-text shadow-[var(--hairline)] focus:outline-none focus:shadow-[var(--hairline),0_0_0_2px_rgba(225,29,72,0.4)]"
        />
      </Field>
      <QrPreview dataUrl={url} />
    </div>
  );
}

/* ── WiFi QR ─────────────────────────────────────────────────── */

function WifiQrTool() {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [auth, setAuth] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [hidden, setHidden] = useState(false);

  // WIFI QR spec: WIFI:S:<ssid>;T:<WPA|WEP|nopass>;P:<password>;H:<true|false>;;
  const escape = (s: string) => s.replace(/([\\;,":])/g, "\\$1");
  const payload = ssid
    ? `WIFI:S:${escape(ssid)};T:${auth};P:${auth === "nopass" ? "" : escape(password)};${hidden ? "H:true;" : ""};`
    : "";
  const url = useQrDataUrl(payload);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-3">
        <Field label="Network name (SSID)">
          <input className={inputCls} value={ssid} onChange={(e) => setSsid(e.target.value)} spellCheck={false} />
        </Field>
        <Field label="Password" hint={auth === "nopass" ? "not required for open networks" : "at least 8 chars for WPA"}>
          <input
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={auth === "nopass"}
            spellCheck={false}
          />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Security">
            <div className="flex gap-1 rounded-[9px] bg-surface p-0.5 shadow-[var(--hairline)] self-start">
              {(["WPA", "WEP", "nopass"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setAuth(m)}
                  className={cn(
                    "rounded-[7px] px-3 py-1 text-[11px] transition-colors",
                    auth === m ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
                  )}
                >
                  {m === "nopass" ? "Open" : m}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Hidden">
            <Toggle label={hidden ? "yes" : "no"} value={hidden} onChange={setHidden} />
          </Field>
        </div>
        <div className="text-[10.5px] text-text-dim">
          Point any phone camera at the QR — iOS &amp; Android join automatically. Nothing leaves this PC; the code is generated locally.
        </div>
      </div>
      <QrPreview dataUrl={url} caption={ssid || "enter SSID above"} />
    </div>
  );
}

function QrPreview({ dataUrl, caption }: { dataUrl: string; caption?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <GlassPanel interactive={false} className="grid h-[320px] w-[320px] place-items-center overflow-hidden bg-[rgba(0,0,0,0.35)] p-4">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR code" className="h-full w-full object-contain" />
        ) : (
          <span className="text-[11px] text-text-dim">Enter text to render</span>
        )}
      </GlassPanel>
      {caption && (
        <div className="mono max-w-[320px] truncate text-[11px] text-text-dim" title={caption}>
          {caption}
        </div>
      )}
    </div>
  );
}

/* ── UUID ────────────────────────────────────────────────────── */

function UuidTool() {
  const [ids, setIds] = useState<string[]>([]);
  const gen = () => setIds(Array.from({ length: 5 }, () => crypto.randomUUID()));
  useEffect(gen, []);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={gen}
        className="focus-ring flex items-center gap-1.5 self-start rounded-[9px] bg-surface-hi px-3 py-1.5 text-[12px] text-text transition-colors hover:text-raspberry"
      >
        <RefreshCw size={13} /> Generate 5 (v4)
      </button>
      <GlassPanel interactive={false} className="overflow-hidden">
        {ids.map((id) => (
          <div key={id} className="flex items-center justify-between gap-2 border-b border-[rgba(255,255,255,0.03)] px-3 py-2">
            <span className="mono text-[12.5px] text-text">{id}</span>
            <CopyButton text={id} />
          </div>
        ))}
      </GlassPanel>
    </div>
  );
}

/* ── Timestamp ───────────────────────────────────────────────── */

function TimeTool() {
  const [unix, setUnix] = useState(() => String(Math.floor(Date.now() / 1000)));
  const parsed = useMemo(() => {
    const n = Number(unix.trim());
    if (!Number.isFinite(n)) return null;
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [unix]);

  const nowRef = useRef(0);
  const [tickNow, setTickNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const iv = window.setInterval(() => setTickNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(iv);
  }, []);
  nowRef.current = tickNow;

  return (
    <div className="flex flex-col gap-3">
      <Field label="Unix timestamp (s or ms)">
        <input
          value={unix}
          onChange={(e) => setUnix(e.target.value)}
          className={inputCls}
          spellCheck={false}
        />
      </Field>
      <GlassPanel interactive={false} className="flex flex-col gap-2 p-4 text-[13px]">
        <Row k="ISO 8601" v={parsed ? parsed.toISOString() : "—"} />
        <Row k="Local" v={parsed ? parsed.toLocaleString() : "—"} />
        <Row k="UTC" v={parsed ? parsed.toUTCString() : "—"} />
        <Row k="Now (live)" v={String(tickNow)} />
      </GlassPanel>
      <button
        type="button"
        onClick={() => setUnix(String(Math.floor(Date.now() / 1000)))}
        className="focus-ring self-start rounded-[9px] bg-surface-hi px-3 py-1.5 text-[12px] text-text transition-colors hover:text-raspberry"
      >
        Snap to now
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wide text-text-dim">{k}</span>
      <span className="mono text-text">{v}</span>
    </div>
  );
}
