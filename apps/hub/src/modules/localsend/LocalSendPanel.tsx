import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Upload,
  Radio,
  ExternalLink,
  Github,
  Copy,
  Check,
  Download,
  Play,
  Wifi,
  FileText,
  X,
  Plus,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { bus } from "@/lib/bus";
import { isTauri } from "@/target";

/**
 * LocalSend — LAN file transfer built on the [LocalSend] protocol.
 *   Spec: https://github.com/localsend/localsend  (Apache 2.0, cross-platform)
 *
 * MVP: browser-side sender. The LocalSend HTTP API (register → prepare-upload
 * → upload) is straightforward, and any device with the LocalSend app open
 * listens on :53317. We pick files, pick a peer by IP, and stream them there.
 *
 * mDNS auto-discovery + a receiver server are Phase 6 (needs Rust — the browser
 * can't bind :53317). For now: enter a peer manually, or use the "install
 * LocalSend on this PC" helper to run the official desktop app alongside
 * Raspberry as the local endpoint.
 */

interface Peer {
  id: string;
  alias: string;
  ip: string;
  port: number;
  addedAt: number;
}

interface SendJob {
  id: string;
  peerAlias: string;
  files: { name: string; size: number }[];
  status: "pending" | "registering" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

const PEER_STORAGE_KEY = "raspberry.localsend.peers";
const DEFAULT_PORT = 53317;

export function LocalSendPanel({ manifest }: { manifest: ModuleManifest }) {
  const [peers, setPeers] = useState<Peer[]>(() => loadPeers());
  const [files, setFiles] = useState<File[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [jobs, setJobs] = useState<SendJob[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [installCopied, setInstallCopied] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(peers));
  }, [peers]);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      el.classList.add("border-raspberry/60");
    };
    const onDragLeave = () => el.classList.remove("border-raspberry/60");
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove("border-raspberry/60");
      if (!e.dataTransfer) return;
      const dropped = Array.from(e.dataTransfer.files);
      if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
    };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  const totalBytes = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);
  const chosenPeer = peers.find((p) => p.id === selectedPeer) ?? null;
  const canSend = chosenPeer !== null && files.length > 0;

  const addPeer = (alias: string, ip: string, port: number) => {
    setPeers((prev) => [
      ...prev,
      {
        id: `${ip}:${port}:${Math.random().toString(36).slice(2, 8)}`,
        alias: alias || ip,
        ip,
        port,
        addedAt: Date.now(),
      },
    ]);
  };

  const removePeer = (id: string) => {
    setPeers((prev) => prev.filter((p) => p.id !== id));
    if (selectedPeer === id) setSelectedPeer(null);
  };

  const startSend = async () => {
    if (!chosenPeer || files.length === 0) return;
    const jobId = `job-${Date.now()}`;
    const job: SendJob = {
      id: jobId,
      peerAlias: chosenPeer.alias,
      files: files.map((f) => ({ name: f.name, size: f.size })),
      status: "registering",
      progress: 0,
    };
    setJobs((prev) => [job, ...prev]);
    setFiles([]);

    try {
      const base = `http://${chosenPeer.ip}:${chosenPeer.port}/api/localsend/v2`;
      const filePayload: Record<string, {
        id: string;
        fileName: string;
        size: number;
        fileType: string;
        sha256?: string;
        preview?: string;
      }> = {};
      const fileIds: string[] = [];
      files.forEach((f, i) => {
        const id = `f${i}`;
        fileIds.push(id);
        filePayload[id] = {
          id,
          fileName: f.name,
          size: f.size,
          fileType: f.type || guessFileType(f.name),
        };
      });

      const prepRes = await fetch(`${base}/prepare-upload`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          info: {
            alias: "Raspberry",
            version: "2.0",
            deviceModel: "Windows",
            deviceType: "desktop",
            fingerprint: getOrCreateFingerprint(),
            download: false,
          },
          files: filePayload,
        }),
      });
      if (!prepRes.ok) throw new Error(`prepare-upload → ${prepRes.status}`);
      const prep = (await prepRes.json()) as {
        sessionId: string;
        files: Record<string, string>;
      };

      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "uploading" } : j)),
      );

      let sentBytes = 0;
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const fid = fileIds[i];
        if (!f || !fid) continue;
        const token = prep.files[fid];
        if (!token) continue;
        const uploadUrl = `${base}/upload?sessionId=${encodeURIComponent(prep.sessionId)}&fileId=${encodeURIComponent(fid)}&token=${encodeURIComponent(token)}`;
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "content-type": "application/octet-stream" },
          body: f,
        });
        if (!res.ok) throw new Error(`upload ${f.name} → ${res.status}`);
        sentBytes += f.size;
        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? { ...j, progress: totalBytes > 0 ? sentBytes / totalBytes : 1 }
              : j,
          ),
        );
      }

      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "done", progress: 1 } : j)),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "error", error: msg } : j)),
      );
    }
  };

  const copyInstall = () => {
    navigator.clipboard
      .writeText("winget install --id LocalSend.LocalSend -e")
      .then(() => {
        setInstallCopied(true);
        setTimeout(() => setInstallCopied(false), 1200);
      });
  };
  const runInstall = () => {
    bus.emit("nav:go", { moduleId: "terminal" });
    setTimeout(
      () =>
        bus.emit("terminal:run", {
          command: "winget install --id LocalSend.LocalSend -e",
        }),
      120,
    );
  };

  return (
    <PanelShell manifest={manifest}>
      <div className="flex h-full flex-col gap-4">
        {/* header */}
        <GlassPanel
          interactive={false}
          className="relative overflow-hidden border-l-2 border-l-raspberry/60 p-4"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.24),transparent_60%)]" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="mono text-[10px] uppercase tracking-wider text-text-dim">
                  Powered by
                </span>
                <a
                  href="https://github.com/localsend/localsend"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring inline-flex items-center gap-1 text-[12px] font-medium text-raspberry underline-offset-2 hover:underline"
                >
                  <Github size={12} /> localsend/localsend
                  <ExternalLink size={10} />
                </a>
              </div>
              <p className="mt-1 max-w-[62ch] text-[12px] leading-relaxed text-text-dim">
                Send files to any device on your LAN running LocalSend. Speaks
                the LocalSend v2 HTTP protocol directly — no cloud, no relay.
                mDNS auto-discovery + inbound receive land in Phase 6.
              </p>
            </div>
          </div>
        </GlassPanel>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* left: files + send */}
          <div className="flex min-h-0 flex-col gap-3">
            <div
              ref={dropRef}
              className="focus-ring flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-stroke bg-[rgba(0,0,0,0.24)] p-6 text-center transition-colors"
            >
              <Upload size={22} className="text-text-dim" />
              <p className="text-[12.5px] text-text">Drop files here to queue them</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="focus-ring mt-1 flex items-center gap-1 rounded-full bg-surface-hi px-3 py-1 text-[11px] text-text-dim shadow-[var(--hairline)] hover:text-text"
              >
                <FileText size={11} /> browse files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files ?? []);
                  if (list.length) setFiles((prev) => [...prev, ...list]);
                  e.target.value = "";
                }}
              />
              {files.length > 0 && (
                <p className="mono text-[10.5px] uppercase tracking-wider text-text-dim">
                  {files.length} file{files.length === 1 ? "" : "s"} · {formatBytes(totalBytes)}
                </p>
              )}
            </div>

            {files.length > 0 && (
              <GlassPanel interactive={false} className="max-h-32 overflow-y-auto p-2">
                <ul className="flex flex-col gap-1">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-[8px] bg-[rgba(0,0,0,0.22)] px-2 py-1"
                    >
                      <FileText size={11} className="shrink-0 text-text-dim" />
                      <span className="truncate text-[11.5px] text-text">{f.name}</span>
                      <span className="mono ml-auto shrink-0 text-[10px] text-text-dim">
                        {formatBytes(f.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="focus-ring rounded p-0.5 text-text-dim hover:text-raspberry"
                        aria-label={`Remove ${f.name}`}
                      >
                        <X size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            )}

            <button
              type="button"
              onClick={startSend}
              disabled={!canSend}
              className={cn(
                "focus-ring flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-medium transition-colors",
                canSend
                  ? "bg-raspberry text-white hover:brightness-110"
                  : "bg-surface text-text-dim shadow-[var(--hairline)]",
              )}
            >
              <Send size={14} />
              {canSend
                ? `Send ${files.length} file${files.length === 1 ? "" : "s"} to ${chosenPeer.alias}`
                : "Pick a peer and add files"}
            </button>

            {/* jobs */}
            <div className="flex-1 overflow-y-auto pr-1">
              {jobs.length === 0 ? (
                <p className="pt-6 text-center text-[11.5px] text-text-dim">
                  Recent transfers will appear here.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {jobs.map((j) => (
                    <JobRow key={j.id} job={j} />
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* right: peers */}
          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] uppercase tracking-wider text-text-dim">
                Peers ({peers.length})
              </span>
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                className="focus-ring flex items-center gap-1 rounded bg-surface-hi px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-text-dim hover:text-raspberry"
              >
                <Plus size={11} /> add
              </button>
            </div>

            {addOpen && (
              <AddPeerForm
                onAdd={(alias, ip, port) => {
                  addPeer(alias, ip, port);
                  setAddOpen(false);
                }}
                onCancel={() => setAddOpen(false)}
              />
            )}

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {peers.length === 0 ? (
                <GlassPanel
                  interactive={false}
                  className="grid place-items-center gap-2 p-6 text-center text-[11.5px] text-text-dim"
                >
                  <Wifi size={22} strokeWidth={1.4} />
                  <p>No peers yet.</p>
                  <p className="max-w-[24ch] leading-relaxed">
                    Open LocalSend on another device, note its IP, then "add".
                  </p>
                </GlassPanel>
              ) : (
                peers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPeer(p.id)}
                    className={cn(
                      "focus-ring group flex items-center gap-2 rounded-[10px] px-3 py-2 text-left shadow-[var(--hairline)] transition-colors",
                      selectedPeer === p.id
                        ? "bg-[rgba(var(--raspberry-rgb),0.16)]"
                        : "bg-surface hover:bg-surface-hi",
                    )}
                  >
                    <Radio
                      size={12}
                      className={cn(
                        "shrink-0",
                        selectedPeer === p.id ? "text-raspberry" : "text-text-dim",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium text-text">
                        {p.alias}
                      </div>
                      <div className="mono truncate text-[10.5px] text-text-dim">
                        {p.ip}:{p.port}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePeer(p.id);
                      }}
                      className="focus-ring rounded p-1 text-text-dim opacity-0 transition-opacity hover:text-raspberry group-hover:opacity-100"
                      aria-label="Remove peer"
                    >
                      <X size={11} />
                    </button>
                  </button>
                ))
              )}
            </div>

            {/* install helper */}
            <GlassPanel interactive={false} className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <Download size={12} className="text-raspberry" />
                <span className="mono text-[10px] uppercase tracking-wider text-text-dim">
                  Install LocalSend
                </span>
              </div>
              <button
                type="button"
                onClick={copyInstall}
                className="focus-ring group flex items-center gap-2 rounded-[8px] bg-[rgba(0,0,0,0.28)] px-2 py-1 text-left transition-colors hover:bg-[rgba(0,0,0,0.36)]"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] bg-surface-hi text-text-dim group-hover:text-raspberry">
                  {installCopied ? (
                    <Check size={10} className="text-raspberry" />
                  ) : (
                    <Copy size={10} />
                  )}
                </span>
                <span className="mono min-w-0 flex-1 truncate text-[10.5px] text-text-dim group-hover:text-text">
                  winget install --id LocalSend.LocalSend -e
                </span>
              </button>
              {isTauri() && (
                <button
                  type="button"
                  onClick={runInstall}
                  className="focus-ring flex w-fit items-center gap-1 rounded bg-surface-hi px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-dim hover:text-raspberry"
                >
                  <Play size={9} strokeWidth={2} /> run
                </button>
              )}
            </GlassPanel>
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

function AddPeerForm({
  onAdd,
  onCancel,
}: {
  onAdd: (alias: string, ip: string, port: number) => void;
  onCancel: () => void;
}) {
  const [alias, setAlias] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState(String(DEFAULT_PORT));

  const valid = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && /^\d{2,5}$/.test(port);

  return (
    <GlassPanel interactive={false} className="flex flex-col gap-2 p-3">
      <input
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        placeholder="Alias (e.g. Phone)"
        className="focus-ring h-8 rounded-[8px] bg-[rgba(0,0,0,0.28)] px-2 text-[11.5px] text-text placeholder:text-text-dim shadow-[var(--hairline)]"
      />
      <input
        value={ip}
        onChange={(e) => setIp(e.target.value)}
        placeholder="192.168.1.42"
        className="focus-ring mono h-8 rounded-[8px] bg-[rgba(0,0,0,0.28)] px-2 text-[11.5px] text-text placeholder:text-text-dim shadow-[var(--hairline)]"
      />
      <input
        value={port}
        onChange={(e) => setPort(e.target.value.replace(/[^\d]/g, ""))}
        placeholder={String(DEFAULT_PORT)}
        className="focus-ring mono h-8 rounded-[8px] bg-[rgba(0,0,0,0.28)] px-2 text-[11.5px] text-text placeholder:text-text-dim shadow-[var(--hairline)]"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => valid && onAdd(alias.trim(), ip.trim(), Number(port))}
          disabled={!valid}
          className={cn(
            "focus-ring flex-1 rounded bg-raspberry px-2 py-1 text-[10.5px] uppercase tracking-wider text-white transition-opacity",
            !valid && "opacity-40",
          )}
        >
          save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring rounded bg-surface-hi px-2 py-1 text-[10.5px] uppercase tracking-wider text-text-dim hover:text-text"
        >
          cancel
        </button>
      </div>
    </GlassPanel>
  );
}

function JobRow({ job }: { job: SendJob }) {
  const pct = Math.round(job.progress * 100);
  const label =
    job.status === "done"
      ? "Sent"
      : job.status === "error"
        ? "Error"
        : job.status === "uploading"
          ? `Uploading ${pct}%`
          : "Preparing…";
  return (
    <GlassPanel interactive={false} className="p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11.5px] text-text">
          {job.files.length} file{job.files.length === 1 ? "" : "s"} → {job.peerAlias}
        </span>
        <span
          className={cn(
            "mono shrink-0 text-[10px] uppercase tracking-wider",
            job.status === "error" ? "text-raspberry" : "text-text-dim",
          )}
        >
          {label}
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            job.status === "error" ? "bg-raspberry/70" : "bg-raspberry",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {job.error && (
        <p className="mono mt-1 truncate text-[10px] text-raspberry" title={job.error}>
          {job.error}
        </p>
      )}
    </GlassPanel>
  );
}

/* ── helpers ─────────────────────────────────────────────────────── */

function loadPeers(): Peer[] {
  try {
    const raw = localStorage.getItem(PEER_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Peer[]) : [];
  } catch {
    return [];
  }
}

function getOrCreateFingerprint(): string {
  const KEY = "raspberry.localsend.fingerprint";
  let v = localStorage.getItem(KEY);
  if (!v) {
    v = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(KEY, v);
  }
  return v;
}

function guessFileType(name: string): string {
  const lower = name.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(lower)) return "image";
  if (/\.(mp4|mov|webm|mkv|avi)$/.test(lower)) return "video";
  if (/\.(mp3|wav|flac|ogg|m4a)$/.test(lower)) return "audio";
  if (/\.(pdf|docx?|xlsx?|pptx?)$/.test(lower)) return "pdf";
  if (/\.(txt|md|json|xml|csv|log)$/.test(lower)) return "text";
  if (/\.(apk|exe|msi|dmg|deb|rpm)$/.test(lower)) return "app";
  return "other";
}

function formatBytes(n: number): string {
  if (!isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
