import { useEffect, useMemo, useState } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";

type Tool = "json" | "base64" | "uuid" | "hash" | "time";
const TOOLS: { key: Tool; label: string }[] = [
  { key: "json", label: "JSON" },
  { key: "base64", label: "Base64" },
  { key: "uuid", label: "UUID" },
  { key: "hash", label: "SHA-256" },
  { key: "time", label: "Timestamp" },
];

/** Developer Toolbox (spec §10.8) — offline utilities, all client-side. */
export function DevToolboxPanel({ manifest }: { manifest: ModuleManifest }) {
  const [tool, setTool] = useState<Tool>("json");
  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-1 rounded-[9px] bg-surface p-0.5 shadow-[var(--hairline)]">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTool(t.key)}
              className={cn(
                "rounded-[7px] px-2.5 py-1 text-[11px] transition-colors",
                tool === t.key ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {tool === "json" && <JsonTool />}
      {tool === "base64" && <Base64Tool />}
      {tool === "uuid" && <UuidTool />}
      {tool === "hash" && <HashTool />}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-text-dim">{label}</span>
      {children}
    </label>
  );
}

const textAreaCls =
  "mono min-h-[120px] w-full resize-y rounded-[10px] bg-[rgba(0,0,0,0.25)] p-3 text-[12px] text-text shadow-[var(--hairline)] focus:outline-none focus:shadow-[var(--hairline),0_0_0_2px_rgba(225,29,72,0.4)]";

/* ── JSON ────────────────────────────────────────────────────── */

function JsonTool() {
  const [input, setInput] = useState('{"raspberry":true,"nested":{"a":[1,2,3]}}');
  const result = useMemo(() => {
    if (!input.trim()) return { ok: true, out: "" };
    try {
      return { ok: true, out: JSON.stringify(JSON.parse(input), null, 2) };
    } catch (e) {
      return { ok: false, out: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }, [input]);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Field label="Input">
        <textarea className={textAreaCls} value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      </Field>
      <Field label={result.ok ? "Formatted" : "Error"}>
        <textarea
          readOnly
          value={result.out}
          spellCheck={false}
          className={cn(textAreaCls, !result.ok && "text-raspberry")}
        />
        {result.ok && result.out && (
          <div className="mt-1 flex justify-end">
            <CopyButton text={result.out} />
          </div>
        )}
      </Field>
    </div>
  );
}

/* ── Base64 ──────────────────────────────────────────────────── */

function Base64Tool() {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState("Hello, Raspberry 🍇");
  const out = useMemo(() => {
    try {
      if (mode === "encode") return btoa(unescape(encodeURIComponent(input)));
      return decodeURIComponent(escape(atob(input)));
    } catch {
      return "⚠ invalid input for this mode";
    }
  }, [mode, input]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-[9px] bg-surface p-0.5 shadow-[var(--hairline)] self-start">
        {(["encode", "decode"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-[7px] px-3 py-1 text-[11px] capitalize transition-colors",
              mode === m ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <Field label="Input">
        <textarea className={textAreaCls} value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      </Field>
      <Field label="Output">
        <textarea readOnly value={out} className={textAreaCls} spellCheck={false} />
        <div className="mt-1 flex justify-end">
          <CopyButton text={out} />
        </div>
      </Field>
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

/* ── SHA-256 ─────────────────────────────────────────────────── */

function HashTool() {
  const [input, setInput] = useState("Raspberry");
  const [digest, setDigest] = useState("");
  useEffect(() => {
    let alive = true;
    crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(input))
      .then((buf) => {
        const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
        if (alive) setDigest(hex);
      });
    return () => {
      alive = false;
    };
  }, [input]);

  return (
    <div className="flex flex-col gap-3">
      <Field label="Input">
        <textarea className={textAreaCls} value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      </Field>
      <Field label="SHA-256">
        <div className="mono flex items-center gap-3 break-all rounded-[10px] bg-[rgba(0,0,0,0.25)] p-3 text-[12px] text-text shadow-[var(--hairline)]">
          {digest}
        </div>
        <div className="mt-1 flex justify-end">
          <CopyButton text={digest} />
        </div>
      </Field>
    </div>
  );
}

/* ── Timestamp ───────────────────────────────────────────────── */

function TimeTool() {
  const [unix, setUnix] = useState(() => String(Math.floor(Date.now() / 1000)));
  const parsed = useMemo(() => {
    const n = Number(unix.trim());
    if (!Number.isFinite(n)) return null;
    // accept seconds or milliseconds
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [unix]);

  return (
    <div className="flex flex-col gap-3">
      <Field label="Unix timestamp (s or ms)">
        <input
          value={unix}
          onChange={(e) => setUnix(e.target.value)}
          className="mono w-full rounded-[10px] bg-[rgba(0,0,0,0.25)] p-3 text-[13px] text-text shadow-[var(--hairline)] focus:outline-none"
          spellCheck={false}
        />
      </Field>
      <GlassPanel interactive={false} className="flex flex-col gap-2 p-4 text-[13px]">
        <Row k="ISO 8601" v={parsed ? parsed.toISOString() : "—"} />
        <Row k="Local" v={parsed ? parsed.toLocaleString() : "—"} />
        <Row k="UTC" v={parsed ? parsed.toUTCString() : "—"} />
      </GlassPanel>
      <button
        type="button"
        onClick={() => setUnix(String(Math.floor(Date.now() / 1000)))}
        className="focus-ring self-start rounded-[9px] bg-surface-hi px-3 py-1.5 text-[12px] text-text transition-colors hover:text-raspberry"
      >
        Now
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
