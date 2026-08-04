import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Play,
  Copy,
  Check,
  Trash2,
  Pencil,
  Search,
  X,
  KeyRound,
  Server,
  ShieldCheck,
  Info,
  Save,
  BookOpen,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";
import { bus } from "@/lib/bus";
import { isTauri } from "@/target";

/* ═══════════════════════════════════════════════════════════════════════
   SSH — saved connections + key helpers.

   Everything is local-first: connections live in localStorage. "Connect"
   emits a `terminal:run` with the resolved `ssh …` command, exactly the
   same handoff Tweaks and Commands use — the user always sees the command
   in the built-in Terminal before pressing Enter.
   ═══════════════════════════════════════════════════════════════════════ */

interface SshServer {
  id: string;
  nickname: string;
  host: string;
  user: string;
  port: number;
  keyPath?: string;
  notes?: string;
  createdAt: number;
}

const STORAGE_KEY = "raspberry.ssh.servers";

function loadServers(): SshServer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SshServer[]) : [];
  } catch {
    return [];
  }
}

function buildSshCommand(s: SshServer): string {
  const parts: string[] = ["ssh"];
  if (s.keyPath) parts.push("-i", quote(s.keyPath));
  if (s.port && s.port !== 22) parts.push("-p", String(s.port));
  parts.push(`${s.user}@${s.host}`);
  return parts.join(" ");
}

function quote(s: string): string {
  return /["\s]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
}

export function SshPanel({ manifest }: { manifest: ModuleManifest }) {
  const [servers, setServers] = useState<SshServer[]>(() => loadServers());
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SshServer | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"servers" | "keys" | "learn">("servers");
  const canRun = isTauri();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers));
  }, [servers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter(
      (s) =>
        s.nickname.toLowerCase().includes(q) ||
        s.host.toLowerCase().includes(q) ||
        s.user.toLowerCase().includes(q) ||
        (s.notes?.toLowerCase().includes(q) ?? false),
    );
  }, [servers, query]);

  const upsert = (draft: SshServer) => {
    setServers((prev) => {
      const idx = prev.findIndex((s) => s.id === draft.id);
      if (idx === -1) return [draft, ...prev];
      const copy = [...prev];
      copy[idx] = draft;
      return copy;
    });
    setEditing(null);
  };

  const remove = (id: string) => setServers((s) => s.filter((x) => x.id !== id));

  const connect = (s: SshServer) => {
    const cmd = buildSshCommand(s);
    bus.emit("nav:go", { moduleId: "terminal" });
    setTimeout(() => bus.emit("terminal:run", { command: cmd }), 120);
  };

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1200);
    });
  };

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="mono rounded-full bg-surface px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-text-dim shadow-[var(--hairline)]">
          {servers.length} saved
        </div>
      }
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-1 self-start rounded-[10px] bg-surface p-0.5 shadow-[var(--hairline)]">
          <TabButton
            active={tab === "servers"}
            icon={<Server size={12} />}
            onClick={() => setTab("servers")}
          >
            Servers
          </TabButton>
          <TabButton
            active={tab === "keys"}
            icon={<KeyRound size={12} />}
            onClick={() => setTab("keys")}
          >
            Keys
          </TabButton>
          <TabButton
            active={tab === "learn"}
            icon={<BookOpen size={12} />}
            onClick={() => setTab("learn")}
          >
            Learn SSH
          </TabButton>
        </div>

        {tab === "servers" && (
          <ServersTab
            servers={filtered}
            allCount={servers.length}
            query={query}
            setQuery={setQuery}
            onAdd={() => setEditing(blankServer())}
            onEdit={(s) => setEditing({ ...s })}
            onDelete={remove}
            onConnect={connect}
            onCopy={copy}
            copiedId={copiedId}
            canRun={canRun}
          />
        )}
        {tab === "keys" && <KeysTab onCopy={copy} copiedId={copiedId} />}
        {tab === "learn" && <LearnTab />}

        {editing && (
          <ServerEditor
            initial={editing}
            existingIds={new Set(servers.map((s) => s.id))}
            onCancel={() => setEditing(null)}
            onSave={upsert}
          />
        )}
      </div>
    </PanelShell>
  );
}

function blankServer(): SshServer {
  return {
    id: crypto.randomUUID(),
    nickname: "",
    host: "",
    user: "",
    port: 22,
    keyPath: "",
    notes: "",
    createdAt: Date.now(),
  };
}

/* ── Servers tab ─────────────────────────────────────────────── */

function ServersTab(props: {
  servers: SshServer[];
  allCount: number;
  query: string;
  setQuery: (q: string) => void;
  onAdd: () => void;
  onEdit: (s: SshServer) => void;
  onDelete: (id: string) => void;
  onConnect: (s: SshServer) => void;
  onCopy: (id: string, text: string) => void;
  copiedId: string | null;
  canRun: boolean;
}) {
  const {
    servers,
    allCount,
    query,
    setQuery,
    onAdd,
    onEdit,
    onDelete,
    onConnect,
    onCopy,
    copiedId,
    canRun,
  } = props;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search servers…"
            className="focus-ring h-9 w-full rounded-[10px] bg-[rgba(0,0,0,0.25)] pl-8 pr-9 text-[13px] text-text placeholder:text-text-dim shadow-[var(--hairline)]"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-dim hover:text-text"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="focus-ring flex items-center gap-1.5 rounded-[10px] bg-[rgba(var(--raspberry-rgb),0.2)] px-3 py-1.5 text-[12px] text-raspberry transition-colors hover:bg-[rgba(var(--raspberry-rgb),0.28)]"
        >
          <Plus size={13} /> Add server
        </button>
      </div>

      {allCount === 0 && (
        <GlassPanel
          interactive={false}
          className="grid place-items-center gap-3 px-6 py-10 text-center"
        >
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[rgba(var(--raspberry-rgb),0.08)] text-text-dim">
            <Server size={22} strokeWidth={1.5} />
          </div>
          <div className="max-w-md text-[13px] leading-relaxed text-text-dim">
            No SSH servers saved yet. Add one — a Raspberry Pi, a VPS, your work
            box, whatever. Then hit <span className="text-text">Connect</span> and
            Raspberry drops the right <span className="mono text-text">ssh …</span>{" "}
            command into the built-in Terminal for you.
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="focus-ring mt-1 flex items-center gap-1.5 rounded-[10px] bg-[rgba(var(--raspberry-rgb),0.2)] px-3 py-1.5 text-[12px] text-raspberry hover:bg-[rgba(var(--raspberry-rgb),0.28)]"
          >
            <Plus size={13} /> Add your first server
          </button>
        </GlassPanel>
      )}

      {allCount > 0 && (
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-2.5 overflow-y-auto pr-1 2xl:grid-cols-2">
          {servers.map((s) => (
            <ServerCard
              key={s.id}
              server={s}
              onConnect={() => onConnect(s)}
              onEdit={() => onEdit(s)}
              onDelete={() => onDelete(s.id)}
              onCopyCommand={() => onCopy(s.id, buildSshCommand(s))}
              copied={copiedId === s.id}
              canRun={canRun}
            />
          ))}
          {servers.length === 0 && (
            <GlassPanel
              interactive={false}
              className="col-span-full grid place-items-center p-8 text-center text-[13px] text-text-dim"
            >
              No servers match "{query}".
            </GlassPanel>
          )}
        </div>
      )}
    </div>
  );
}

function ServerCard({
  server,
  onConnect,
  onEdit,
  onDelete,
  onCopyCommand,
  copied,
  canRun,
}: {
  server: SshServer;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyCommand: () => void;
  copied: boolean;
  canRun: boolean;
}) {
  const cmd = buildSshCommand(server);
  return (
    <GlassPanel interactive={false} className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold text-text">
              {server.nickname || `${server.user}@${server.host}`}
            </span>
            {server.keyPath && (
              <span
                className="mono flex items-center gap-1 rounded-full bg-[rgba(56,189,248,0.16)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-text"
                title={`Uses key: ${server.keyPath}`}
              >
                <KeyRound size={9} strokeWidth={2.2} /> key
              </span>
            )}
          </div>
          <div className="mono mt-0.5 truncate text-[11.5px] text-text-dim">
            {server.user}@{server.host}
            {server.port !== 22 ? ` · :${server.port}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconAction label="Edit" onClick={onEdit}>
            <Pencil size={12} />
          </IconAction>
          <IconAction label="Delete" onClick={onDelete} danger>
            <Trash2 size={12} />
          </IconAction>
        </div>
      </div>

      <button
        type="button"
        onClick={onCopyCommand}
        className="focus-ring group flex items-center gap-2 rounded-[8px] bg-[rgba(0,0,0,0.28)] px-2.5 py-1.5 text-left shadow-[var(--hairline)] transition-colors hover:bg-[rgba(0,0,0,0.36)]"
        title="Click to copy"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-surface-hi text-text-dim transition-colors group-hover:text-raspberry">
          {copied ? <Check size={12} className="text-raspberry" /> : <Copy size={12} />}
        </span>
        <span className="mono min-w-0 flex-1 truncate text-[11.5px] text-text-dim group-hover:text-text">
          {cmd}
        </span>
      </button>

      {server.notes && (
        <div className="rounded-[8px] bg-[rgba(255,255,255,0.02)] px-2.5 py-1.5 text-[11.5px] leading-relaxed text-text-dim">
          {server.notes}
        </div>
      )}

      {canRun && (
        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={onConnect}
            className="focus-ring flex items-center gap-1.5 rounded-[8px] bg-raspberry/90 px-3 py-1 text-[12px] font-medium text-white transition-colors hover:bg-raspberry"
            title="Send to the built-in Terminal (does not auto-press Enter)"
          >
            <Play size={12} strokeWidth={2.2} /> Connect
          </button>
        </div>
      )}
    </GlassPanel>
  );
}

/* ── Keys tab ────────────────────────────────────────────────── */

function KeysTab({
  onCopy,
  copiedId,
}: {
  onCopy: (id: string, text: string) => void;
  copiedId: string | null;
}) {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      <GlassPanel
        interactive={false}
        className="flex items-start gap-3 border-l-2 border-l-[rgba(56,189,248,0.6)] px-4 py-3"
      >
        <Info size={14} className="mt-0.5 shrink-0 text-sky-300" />
        <div className="text-[12.5px] leading-relaxed text-text">
          <div className="text-[11px] uppercase tracking-wider text-text-dim/80">
            What is an SSH key?
          </div>
          <p className="mt-1">
            An SSH key is a two-file pair — a private half you keep secret on
            this machine, and a public half you paste onto every server you want
            passwordless access to. The server checks that whoever's connecting
            holds the matching private half. It's the same idea as a physical
            key + lock, just cryptographic.
          </p>
          <p className="mt-2 text-text-dim">
            Use <span className="mono text-text">Ed25519</span> — it's smaller,
            faster, and safer than the older <span className="mono">RSA</span>{" "}
            default you'll still see in tutorials.
          </p>
        </div>
      </GlassPanel>

      <KeyRecipe
        id="keygen-ed25519"
        title="Generate a new Ed25519 key"
        subtitle="Modern default. Runs in the built-in Terminal."
        command={`ssh-keygen -t ed25519 -C "you@example.com"`}
        onCopy={onCopy}
        copied={copiedId === "keygen-ed25519"}
      >
        Creates <span className="mono text-text">~/.ssh/id_ed25519</span> (secret)
        and <span className="mono text-text">~/.ssh/id_ed25519.pub</span>{" "}
        (safe to share). It'll ask for a passphrase — <em>use one</em>. That's
        the seatbelt if your laptop ever grows legs.
      </KeyRecipe>

      <KeyRecipe
        id="show-pubkey"
        title="Copy your public key to the clipboard"
        subtitle="Paste this on GitHub, a server, or wherever you're authorizing."
        command={`Get-Content $env:USERPROFILE\\.ssh\\id_ed25519.pub | Set-Clipboard`}
        onCopy={onCopy}
        copied={copiedId === "show-pubkey"}
      >
        PowerShell one-liner. Prints your public key and drops it on the
        clipboard in one shot — safe to share anywhere.
      </KeyRecipe>

      <KeyRecipe
        id="copy-to-server"
        title="Install your key on a server"
        subtitle="After this you won't need a password on that server anymore."
        command={`type $env:USERPROFILE\\.ssh\\id_ed25519.pub | ssh user@host "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"`}
        onCopy={onCopy}
        copied={copiedId === "copy-to-server"}
      >
        The Windows equivalent of Linux's <span className="mono">ssh-copy-id</span>
        . Replace <span className="mono text-text">user@host</span> with the
        server you want to trust this key. You'll type the server password one
        last time, then the key takes over.
      </KeyRecipe>

      <KeyRecipe
        id="agent-start"
        title="Enable the ssh-agent service"
        subtitle="So Windows remembers your key passphrase between sessions."
        command={`Get-Service ssh-agent | Set-Service -StartupType Automatic ; Start-Service ssh-agent ; ssh-add $env:USERPROFILE\\.ssh\\id_ed25519`}
        onCopy={onCopy}
        copied={copiedId === "agent-start"}
      >
        Type your passphrase once per boot instead of every connection. Needs
        Terminal running as Administrator the first time.
      </KeyRecipe>

      <KeyRecipe
        id="ssh-config"
        title="Where the SSH config lives"
        subtitle="Optional — shortcuts + per-host defaults."
        command={`notepad $env:USERPROFILE\\.ssh\\config`}
        onCopy={onCopy}
        copied={copiedId === "ssh-config"}
      >
        Add entries like{" "}
        <span className="mono text-text">Host pi</span> /{" "}
        <span className="mono text-text">HostName 192.168.1.42</span> /{" "}
        <span className="mono text-text">User luke</span> — then just type{" "}
        <span className="mono text-text">ssh pi</span> from anywhere.
      </KeyRecipe>
    </div>
  );
}

function KeyRecipe({
  id,
  title,
  subtitle,
  command,
  children,
  onCopy,
  copied,
}: {
  id: string;
  title: string;
  subtitle: string;
  command: string;
  children: React.ReactNode;
  onCopy: (id: string, text: string) => void;
  copied: boolean;
}) {
  return (
    <GlassPanel interactive={false} className="flex flex-col gap-2 p-4">
      <div>
        <div className="text-[13px] font-semibold text-text">{title}</div>
        <div className="text-[11.5px] text-text-dim">{subtitle}</div>
      </div>
      <button
        type="button"
        onClick={() => onCopy(id, command)}
        className="focus-ring group flex items-center gap-2 rounded-[8px] bg-[rgba(0,0,0,0.28)] px-2.5 py-1.5 text-left shadow-[var(--hairline)] transition-colors hover:bg-[rgba(0,0,0,0.36)]"
        title="Click to copy"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-surface-hi text-text-dim transition-colors group-hover:text-raspberry">
          {copied ? <Check size={12} className="text-raspberry" /> : <Copy size={12} />}
        </span>
        <span className="mono min-w-0 flex-1 whitespace-pre-wrap break-all text-[11.5px] leading-relaxed text-text-dim group-hover:text-text">
          {command}
        </span>
      </button>
      <p className="text-[12px] leading-relaxed text-text-dim">{children}</p>
    </GlassPanel>
  );
}

/* ── Learn tab ───────────────────────────────────────────────── */

function LearnTab() {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      <GlassPanel
        interactive={false}
        className="flex items-start gap-3 border-l-2 border-l-raspberry/60 px-4 py-3"
      >
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-raspberry" />
        <div className="text-[12.5px] leading-relaxed text-text">
          <div className="text-[11px] uppercase tracking-wider text-text-dim/80">
            SSH in one paragraph
          </div>
          <p className="mt-1">
            <span className="text-raspberry">SSH</span> (Secure Shell) lets you
            open a terminal on another computer — over the internet or your
            LAN — as if you were sitting in front of it. You type on your
            machine; the commands run on the other one. It's how sysadmins
            manage servers, how developers push to GitHub, how folks tinker with
            a Raspberry Pi across the house.
          </p>
        </div>
      </GlassPanel>

      <LearnCard title="How a connection actually happens">
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-text">
          <li>You run <span className="mono text-text">ssh user@host</span>.</li>
          <li>Your machine and the server agree on encryption — nobody in the middle can read the traffic.</li>
          <li>
            The server asks you to prove you're really you: <em>either</em> by
            typing a password, <em>or</em> by having a matching SSH key.
          </li>
          <li>If it checks out, you get a shell on the remote box.</li>
        </ol>
      </LearnCard>

      <LearnCard title="The three ways to log in">
        <ul className="mt-1 list-disc space-y-1 pl-5 text-text">
          <li>
            <span className="text-text">Password</span> — simplest, but weakest.
            Fine for a home LAN box behind a firewall; a bad idea on the open
            internet.
          </li>
          <li>
            <span className="text-text">Key</span> — the modern default.
            Passwordless once set up. Attackers can't guess a 4096-bit private
            key.
          </li>
          <li>
            <span className="text-text">Key + passphrase</span> — best of both.
            The private key on disk is itself encrypted, so if a laptop is
            stolen the key alone is useless. Combine with the ssh-agent so you
            only type the passphrase once per boot.
          </li>
        </ul>
      </LearnCard>

      <LearnCard title="What Raspberry does for you">
        <ul className="mt-1 list-disc space-y-1 pl-5 text-text">
          <li>Saves the tedious parts — hostname, user, port, key path — behind a nickname.</li>
          <li>Builds the correct <span className="mono">ssh</span> command and hands it to the built-in Terminal.</li>
          <li>
            <span className="text-text">Never</span> pastes and presses Enter —
            you always get one last look at the command before it runs.
          </li>
          <li>All server data lives on this machine (browser localStorage). Nothing is uploaded anywhere.</li>
        </ul>
      </LearnCard>

      <LearnCard title="Common flags cheatsheet">
        <div className="mt-1 grid grid-cols-1 gap-1.5 text-[12px] md:grid-cols-2">
          <FlagRow flag="-i <path>" what="Use this private key" />
          <FlagRow flag="-p <n>" what="Connect to non-default port" />
          <FlagRow flag="-L 8080:host:80" what="Local port forward" />
          <FlagRow flag="-R 8080:host:80" what="Reverse port forward" />
          <FlagRow flag="-D 1080" what="SOCKS proxy through the server" />
          <FlagRow flag="-N" what="Don't open a shell — just forward" />
          <FlagRow flag="-v" what="Verbose (great for debugging)" />
          <FlagRow flag="-C" what="Compress data (slow links)" />
        </div>
      </LearnCard>
    </div>
  );
}

function LearnCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassPanel interactive={false} className="p-4">
      <div className="text-[13px] font-semibold text-text">{title}</div>
      <div className="mt-1 text-[12px] leading-relaxed text-text-dim">{children}</div>
    </GlassPanel>
  );
}

function FlagRow({ flag, what }: { flag: string; what: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[8px] bg-[rgba(0,0,0,0.22)] px-2.5 py-1.5">
      <span className="mono shrink-0 text-[11px] text-raspberry">{flag}</span>
      <span className="text-text-dim">{what}</span>
    </div>
  );
}

/* ── Server editor modal ─────────────────────────────────────── */

function ServerEditor({
  initial,
  existingIds,
  onCancel,
  onSave,
}: {
  initial: SshServer;
  existingIds: Set<string>;
  onCancel: () => void;
  onSave: (s: SshServer) => void;
}) {
  const [form, setForm] = useState<SshServer>(initial);
  const isEdit = existingIds.has(initial.id);

  const set = <K extends keyof SshServer>(k: K, v: SshServer[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const valid = form.host.trim() !== "" && form.user.trim() !== "" && form.port > 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
      <GlassPanel
        interactive={false}
        className="w-full max-w-md overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] px-5 py-3">
          <div className="text-[13.5px] font-semibold text-text">
            {isEdit ? "Edit server" : "Add server"}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="focus-ring rounded p-1 text-text-dim hover:text-text"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <Field label="Nickname" hint="What YOU call this box.">
            <input
              value={form.nickname}
              onChange={(e) => set("nickname", e.target.value)}
              placeholder="pi, workvm, homelab…"
              className="focus-ring h-9 w-full rounded-[8px] bg-[rgba(0,0,0,0.28)] px-3 text-[12.5px] text-text shadow-[var(--hairline)]"
            />
          </Field>
          <div className="grid grid-cols-[1fr_100px] gap-2">
            <Field label="Host" hint="IP address or hostname.">
              <input
                value={form.host}
                onChange={(e) => set("host", e.target.value)}
                placeholder="192.168.1.42 or pi.local"
                className="focus-ring h-9 w-full rounded-[8px] bg-[rgba(0,0,0,0.28)] px-3 text-[12.5px] text-text shadow-[var(--hairline)]"
                spellCheck={false}
              />
            </Field>
            <Field label="Port">
              <input
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) => set("port", Number(e.target.value) || 22)}
                className="mono focus-ring h-9 w-full rounded-[8px] bg-[rgba(0,0,0,0.28)] px-3 text-[12.5px] text-text shadow-[var(--hairline)]"
              />
            </Field>
          </div>
          <Field label="User">
            <input
              value={form.user}
              onChange={(e) => set("user", e.target.value)}
              placeholder="root, pi, luke…"
              className="focus-ring h-9 w-full rounded-[8px] bg-[rgba(0,0,0,0.28)] px-3 text-[12.5px] text-text shadow-[var(--hairline)]"
              spellCheck={false}
            />
          </Field>
          <Field label="Private key path (optional)" hint="If left empty, ssh uses password auth or your default key.">
            <input
              value={form.keyPath ?? ""}
              onChange={(e) => set("keyPath", e.target.value)}
              placeholder="C:\\Users\\you\\.ssh\\id_ed25519"
              className="mono focus-ring h-9 w-full rounded-[8px] bg-[rgba(0,0,0,0.28)] px-3 text-[12px] text-text shadow-[var(--hairline)]"
              spellCheck={false}
            />
          </Field>
          <Field label="Notes (optional)">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Anything to remember about this box…"
              className="focus-ring w-full resize-none rounded-[8px] bg-[rgba(0,0,0,0.28)] px-3 py-2 text-[12px] text-text shadow-[var(--hairline)]"
            />
          </Field>

          <div className="rounded-[8px] bg-[rgba(0,0,0,0.28)] px-3 py-2 shadow-[var(--hairline)]">
            <div className="text-[10.5px] uppercase tracking-wider text-text-dim">
              Command preview
            </div>
            <div className="mono mt-1 break-all text-[11.5px] text-text">
              {valid ? buildSshCommand(form) : "fill host + user + port"}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.04)] bg-[rgba(0,0,0,0.18)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring rounded-[8px] px-3 py-1.5 text-[12px] text-text-dim hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => valid && onSave(form)}
            disabled={!valid}
            className="focus-ring flex items-center gap-1.5 rounded-[8px] bg-[rgba(var(--raspberry-rgb),0.2)] px-3 py-1.5 text-[12px] text-raspberry transition-colors hover:bg-[rgba(var(--raspberry-rgb),0.28)] disabled:opacity-40"
          >
            <Save size={12} /> {isEdit ? "Save changes" : "Add"}
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-wider text-text-dim">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[10.5px] text-text-dim/70">{hint}</span>}
    </label>
  );
}

/* ── little primitives ─────────────────────────────────────── */

function TabButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[11.5px] transition-colors",
        active ? "bg-surface-hi text-text" : "text-text-dim hover:text-text",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function IconAction({
  label,
  children,
  onClick,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring grid h-6 w-6 place-items-center rounded-[6px] text-text-dim transition-colors",
        danger ? "hover:bg-[rgba(225,29,72,0.16)] hover:text-red-300" : "hover:bg-surface-hi hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
