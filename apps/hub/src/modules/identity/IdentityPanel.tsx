import { useMemo, useState } from "react";
import {
  Search,
  Mail,
  UserRound,
  Copy,
  Check,
  Play,
  ExternalLink,
  Github,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { bus } from "@/lib/bus";
import { isTauri } from "@/target";

type Mode = "email" | "username" | "auto";

/**
 * Identity — email + username OSINT via [Holehe] and [Sherlock].
 *   Holehe   → https://github.com/megadose/holehe        (email → sites where an account exists)
 *   Sherlock → https://github.com/sherlock-project/sherlock (username → 400+ social profiles)
 *
 * We don't ship either binary. The panel builds the exact command line, copies
 * on click, and (in the native app) can paste it straight into the built-in
 * Terminal. There's a one-line install helper for pipx too.
 *
 * MVP intentionally has no live results table — running these queries the wrong
 * way from a webview would leak IP/User-Agent to hundreds of endpoints. Better
 * to run them from PowerShell where the user controls networking. Phase 6 will
 * add a Rust-backed streaming runner that speaks Sherlock/Holehe's stdout.
 */
export function IdentityPanel({ manifest }: { manifest: ModuleManifest }) {
  const [target, setTarget] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [copied, setCopied] = useState<string | null>(null);

  const detected = useMemo<Exclude<Mode, "auto">>(() => {
    if (mode !== "auto") return mode;
    return target.includes("@") ? "email" : "username";
  }, [mode, target]);

  const trimmed = target.trim();
  const valid = trimmed.length > 0 && (detected === "email" ? /.+@.+\..+/.test(trimmed) : /^[A-Za-z0-9._-]{2,32}$/.test(trimmed));

  const commands = useMemo(() => {
    if (!valid) return [] as { id: string; label: string; command: string; hint: string; danger?: "info" }[];
    if (detected === "email") {
      return [
        {
          id: "holehe-basic",
          label: "Holehe — scan 100+ sites for this email",
          command: `holehe --only-used ${trimmed}`,
          hint: "Lists only sites where the email is registered. Add --nocolor for logfile-friendly output.",
        },
        {
          id: "holehe-verbose",
          label: "Holehe — verbose (show 'not found' too)",
          command: `holehe ${trimmed}`,
          hint: "Full report including negatives and rate-limited services.",
        },
        {
          id: "haveibeenpwned",
          label: "Have I Been Pwned lookup (browser)",
          command: `Start-Process "https://haveibeenpwned.com/account/${encodeURIComponent(trimmed)}"`,
          hint: "Opens Troy Hunt's HIBP breach index in your default browser.",
        },
      ];
    }
    return [
      {
        id: "sherlock-basic",
        label: "Sherlock — check 400+ sites for this username",
        command: `sherlock ${trimmed} --print-found --timeout 8`,
        hint: "Prints only sites where the handle exists. 8-second timeout per site.",
      },
      {
        id: "sherlock-nsfw",
        label: "Sherlock — include NSFW site set",
        command: `sherlock ${trimmed} --print-found --nsfw --timeout 8`,
        hint: "Same as above with adult-content sites enabled.",
      },
      {
        id: "sherlock-tor",
        label: "Sherlock — route via Tor",
        command: `sherlock ${trimmed} --print-found --tor --timeout 15`,
        hint: "Requires a running Tor SOCKS proxy on 9050. Slower but doesn't leak your IP.",
      },
      {
        id: "namechk-open",
        label: "Namechk (browser)",
        command: `Start-Process "https://namechk.com/?q=${encodeURIComponent(trimmed)}"`,
        hint: "Second-opinion username lookup in a browser tab.",
      },
    ];
  }, [detected, trimmed, valid]);

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

  return (
    <PanelShell manifest={manifest}>
      <div className="flex h-full flex-col gap-4">
        {/* mode toggle */}
        <GlassPanel interactive={false} className="p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="mono text-[10px] uppercase tracking-wider text-text-dim">
              Look up
            </span>
            <div className="flex gap-1 rounded-full bg-[rgba(0,0,0,0.28)] p-0.5 shadow-[var(--hairline)]">
              <SegBtn active={mode === "auto"} onClick={() => setMode("auto")}>
                <Sparkles size={11} /> Auto
              </SegBtn>
              <SegBtn active={mode === "email"} onClick={() => setMode("email")}>
                <Mail size={11} /> Email
              </SegBtn>
              <SegBtn active={mode === "username"} onClick={() => setMode("username")}>
                <UserRound size={11} /> Username
              </SegBtn>
            </div>
          </div>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={
                detected === "email"
                  ? "someone@example.com"
                  : "someusername"
              }
              className="focus-ring h-10 w-full rounded-[10px] bg-[rgba(0,0,0,0.28)] pl-8 pr-24 text-[13.5px] text-text placeholder:text-text-dim shadow-[var(--hairline)]"
              spellCheck={false}
              autoComplete="off"
            />
            <span className="absolute right-3 top-1/2 mono flex -translate-y-1/2 items-center gap-1 text-[10px] uppercase tracking-wider text-text-dim">
              detected: <span className="text-raspberry">{detected}</span>
            </span>
          </div>
        </GlassPanel>

        {/* command list */}
        {!valid ? (
          <EmptyHint />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
            {commands.map((c) => (
              <GlassPanel key={c.id} interactive={false} className="flex flex-col gap-2 px-4 pb-3 pt-3">
                <div className="flex items-start gap-2">
                  <span className="text-[13px] font-medium leading-snug text-text">
                    {c.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copy(c.id, c.command)}
                  className="focus-ring group flex items-center gap-2 rounded-[8px] bg-[rgba(0,0,0,0.28)] px-2.5 py-1.5 text-left shadow-[var(--hairline)] transition-colors hover:bg-[rgba(0,0,0,0.36)]"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-surface-hi text-text-dim transition-colors group-hover:text-raspberry">
                    {copied === c.id ? (
                      <Check size={12} className="text-raspberry" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </span>
                  <span className="mono min-w-0 flex-1 break-all text-[11.5px] leading-relaxed text-text-dim group-hover:text-text">
                    {c.command}
                  </span>
                </button>
                <p className="text-[11.5px] leading-relaxed text-text-dim">{c.hint}</p>
                {isTauri() && (
                  <button
                    type="button"
                    onClick={() => run(c.command)}
                    className="focus-ring mt-1 flex w-fit items-center gap-1 rounded bg-surface-hi px-2 py-0.5 text-[10.5px] uppercase tracking-wider text-text-dim transition-colors hover:text-raspberry"
                  >
                    <Play size={10} strokeWidth={2} /> run in terminal
                  </button>
                )}
              </GlassPanel>
            ))}
          </div>
        )}

        {/* install helper */}
        <GlassPanel interactive={false} className="mt-1 flex flex-col gap-3 px-4 pb-3 pt-3">
          <div className="flex items-center gap-2">
            <Github size={14} className="text-raspberry" />
            <span className="mono text-[10.5px] uppercase tracking-wider text-text-dim">
              First-time setup
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-text-dim">
            Both tools are Python. Install once via pipx and they're on PATH for every shell:
          </p>
          <button
            type="button"
            onClick={() =>
              copy(
                "install",
                "python -m pip install --user pipx ; python -m pipx ensurepath ; pipx install holehe ; pipx install sherlock-project",
              )
            }
            className="focus-ring group flex items-center gap-2 rounded-[8px] bg-[rgba(0,0,0,0.28)] px-2.5 py-1.5 text-left shadow-[var(--hairline)] transition-colors hover:bg-[rgba(0,0,0,0.36)]"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-surface-hi text-text-dim transition-colors group-hover:text-raspberry">
              {copied === "install" ? (
                <Check size={12} className="text-raspberry" />
              ) : (
                <Copy size={12} />
              )}
            </span>
            <span className="mono min-w-0 flex-1 break-all text-[11.5px] leading-relaxed text-text-dim group-hover:text-text">
              python -m pip install --user pipx ; python -m pipx ensurepath ; pipx install
              holehe ; pipx install sherlock-project
            </span>
          </button>
          <div className="flex flex-wrap gap-2 text-[11px] text-text-dim">
            <RepoLink href="https://github.com/megadose/holehe" label="Holehe" />
            <RepoLink href="https://github.com/sherlock-project/sherlock" label="Sherlock" />
          </div>
        </GlassPanel>
      </div>
    </PanelShell>
  );
}

function SegBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] uppercase tracking-wider transition-colors",
        active ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function RepoLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-ring inline-flex items-center gap-1 rounded bg-surface-hi px-2 py-0.5 uppercase tracking-wider hover:text-raspberry"
    >
      <ExternalLink size={10} /> {label}
    </a>
  );
}

function EmptyHint() {
  return (
    <GlassPanel
      interactive={false}
      className="grid place-items-center gap-2 p-8 text-center"
    >
      <ShieldQuestion size={28} strokeWidth={1.4} className="text-text-dim" />
      <p className="text-[13px] text-text">Type an email or a username to build a lookup.</p>
      <p className="max-w-[46ch] text-[11.5px] leading-relaxed text-text-dim">
        Auto-detects <span className="text-raspberry">email</span> (anything with an{" "}
        <span className="mono">@</span>) or{" "}
        <span className="text-raspberry">username</span> (letters/numbers/dot/dash/underscore).
        Everything runs from your own PowerShell — Raspberry only prepares the command.
      </p>
    </GlassPanel>
  );
}
