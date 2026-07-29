import { useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Github,
  Play,
  Cpu,
  Radio,
  Layers,
  Hash,
  Fingerprint,
  Shield,
  Download,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { bus } from "@/lib/bus";
import { isTauri } from "@/target";

/**
 * Kernel Inspector — a hacker-tier companion to Process Explorer.
 *
 * Powered by [System Informer] (formerly Process Hacker):
 *   https://github.com/winsiderss/systeminformer
 *
 * We don't reimplement its UI. Instead we surface the ONE-CLICK actions a
 * power user actually reaches for: launching it against a PID, dumping a
 * process, listing kernel drivers, viewing loaded DLLs / TCP endpoints per
 * process, and installing it via winget if it isn't on the system yet.
 *
 * Everything here still runs behind an explicit user click. No auto-elevation,
 * no background process mutation.
 */
export function KernelInspectorPanel({ manifest }: { manifest: ModuleManifest }) {
  const [pid, setPid] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const canLaunch = pid.trim() === "" || /^\d+$/.test(pid.trim());
  const targetPid = pid.trim();

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied((prev) => (prev === id ? null : prev)), 1200);
    });
  };

  const run = (text: string) => {
    bus.emit("nav:go", { moduleId: "terminal" });
    setTimeout(() => bus.emit("terminal:run", { command: text }), 120);
  };

  const actions = [
    {
      id: "install",
      icon: Download,
      label: "Install System Informer (winget)",
      command: "winget install --id WinsiderSS.SystemInformer -e",
      hint: "One-time install of the successor to Process Hacker. Portable — no shell integration.",
      admin: true,
    },
    {
      id: "launch",
      icon: Play,
      label: targetPid ? `Launch and select PID ${targetPid}` : "Launch System Informer",
      command: targetPid
        ? `Start-Process SystemInformer.exe -ArgumentList "-selectpid","${targetPid}"`
        : "Start-Process SystemInformer.exe",
      hint: "Opens the full System Informer window. If a PID is provided, it jumps straight to that process.",
    },
    {
      id: "handles",
      icon: Fingerprint,
      label: "Dump all open handles for a PID",
      command: targetPid
        ? `Get-Process -Id ${targetPid} | Format-Table Handles, WorkingSet64, PriorityClass -AutoSize`
        : "handle.exe -a -u (needs Sysinternals Handle.exe)",
      hint: "Quick built-in view. For full handle metadata (files, mutexes, keys, tokens) use Sysinternals `handle.exe -p <pid>`.",
    },
    {
      id: "dlls",
      icon: Layers,
      label: "List loaded DLLs for a PID",
      command: targetPid
        ? `Get-Process -Id ${targetPid} -Module | Select-Object ModuleName, FileName, FileVersion | Format-Table -AutoSize`
        : "Get-Process -Name notepad -Module | Format-Table",
      hint: "Every DLL a process has mapped. Handy for spotting injected modules that shouldn't be there.",
    },
    {
      id: "tcp",
      icon: Radio,
      label: "Show TCP endpoints for a PID",
      command: targetPid
        ? `Get-NetTCPConnection -OwningProcess ${targetPid} | Format-Table LocalAddress, LocalPort, RemoteAddress, RemotePort, State -AutoSize`
        : "Get-NetTCPConnection | Where State -eq Established | Format-Table",
      hint: "What is that process actually talking to? Cross-reference against your firewall log.",
    },
    {
      id: "drivers",
      icon: Shield,
      label: "List all loaded kernel drivers",
      command: "driverquery /v /fo table",
      hint: "Every driver in the kernel, with state, path, and start type. Look for suspicious 'BOOT' or missing signatures.",
      admin: false,
    },
    {
      id: "suspend",
      icon: Cpu,
      label: "Suspend a process (freeze without killing)",
      command: targetPid
        ? `# uses PsSuspend from Sysinternals\npssuspend ${targetPid}`
        : "pssuspend <pid>",
      hint: "Freezes a process so it stops doing whatever it's doing. Resume with `pssuspend -r <pid>`. Needs Sysinternals PsSuspend.",
      admin: true,
    },
    {
      id: "dump",
      icon: Hash,
      label: "Full memory dump of a PID",
      command: targetPid
        ? `procdump -ma ${targetPid} C:\\Temp\\pid-${targetPid}.dmp`
        : "procdump -ma <pid> C:\\Temp\\dump.dmp",
      hint: "Writes a full-memory .dmp of a running process for forensic analysis in WinDbg. Needs Sysinternals ProcDump.",
      admin: true,
    },
  ];

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
                  href="https://github.com/winsiderss/systeminformer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring inline-flex items-center gap-1 text-[12px] font-medium text-raspberry underline-offset-2 hover:underline"
                >
                  <Github size={12} /> winsiderss/systeminformer
                  <ExternalLink size={10} />
                </a>
              </div>
              <p className="mt-1 max-w-[62ch] text-[12px] leading-relaxed text-text-dim">
                Deep native Windows visibility: handles, threads, DLLs, TCP
                endpoints, tokens, and kernel drivers per-process. Read-only by
                default from Raspberry — actions only run when you click the copy
                or run button below.
              </p>
            </div>
          </div>
        </GlassPanel>

        {/* pid input */}
        <GlassPanel interactive={false} className="p-3">
          <label className="flex items-center gap-3">
            <span className="mono text-[10.5px] uppercase tracking-wider text-text-dim">
              Target PID
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={pid}
              onChange={(e) => setPid(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="(optional — commands work without it)"
              className={cn(
                "focus-ring mono h-9 flex-1 rounded-[10px] bg-[rgba(0,0,0,0.28)] px-3 text-[13px] text-text placeholder:text-text-dim shadow-[var(--hairline)]",
                !canLaunch && "text-raspberry",
              )}
              spellCheck={false}
            />
            {targetPid && (
              <button
                type="button"
                onClick={() => setPid("")}
                className="focus-ring rounded bg-surface-hi px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-text-dim hover:text-text"
              >
                clear
              </button>
            )}
          </label>
          <p className="mt-2 text-[11px] text-text-dim">
            Tip: grab a PID from{" "}
            <button
              type="button"
              onClick={() => bus.emit("nav:go", { moduleId: "process-explorer" })}
              className="focus-ring rounded px-1 py-0.5 text-raspberry underline-offset-2 hover:underline"
            >
              Process Explorer
            </button>{" "}
            or the built-in Task Manager.
          </p>
        </GlassPanel>

        {/* actions */}
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-2.5 overflow-y-auto pr-1 xl:grid-cols-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <GlassPanel key={a.id} interactive={false} className="flex flex-col gap-2 px-4 pb-3 pt-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-surface-hi text-raspberry shadow-[var(--hairline)]">
                    <Icon size={14} strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium leading-snug text-text">
                        {a.label}
                      </span>
                      {a.admin && (
                        <span className="mono rounded-full bg-[rgba(225,29,72,0.14)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-raspberry">
                          admin
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copy(a.id, a.command)}
                  className="focus-ring group flex items-center gap-2 rounded-[8px] bg-[rgba(0,0,0,0.28)] px-2.5 py-1.5 text-left shadow-[var(--hairline)] transition-colors hover:bg-[rgba(0,0,0,0.36)]"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-surface-hi text-text-dim transition-colors group-hover:text-raspberry">
                    {copied === a.id ? (
                      <Check size={12} className="text-raspberry" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </span>
                  <span className="mono min-w-0 flex-1 whitespace-pre-wrap break-all text-[11.5px] leading-relaxed text-text-dim group-hover:text-text">
                    {a.command}
                  </span>
                </button>
                <p className="text-[11.5px] leading-relaxed text-text-dim">{a.hint}</p>
                {isTauri() && (
                  <button
                    type="button"
                    onClick={() => run(a.command)}
                    className="focus-ring mt-1 flex w-fit items-center gap-1 rounded bg-surface-hi px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-text-dim transition-colors hover:text-raspberry"
                  >
                    <Play size={10} strokeWidth={2} /> run in terminal
                  </button>
                )}
              </GlassPanel>
            );
          })}
        </div>
      </div>
    </PanelShell>
  );
}
