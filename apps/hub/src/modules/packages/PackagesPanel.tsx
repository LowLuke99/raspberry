import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  ArrowUpCircle,
  Search,
  Trash2,
  Download,
  Loader2,
  Package as PackageIcon,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import type { Package, PackageActionResult } from "@/target";
import { target } from "@/target";
import { PanelShell } from "@/ui/PanelShell";
import { GlassPanel } from "@/ui/GlassPanel";
import { cn } from "@/lib/cn";

type Tab = "installed" | "upgradable" | "search";

/**
 * Packages — winget wrapper. Read-only listing everywhere; install / uninstall /
 * upgrade only on live targets (Hub-local). Remote agents can browse installed
 * + upgradable + search, but action buttons are hidden — mutations don't cross
 * the agent boundary yet.
 */
export function PackagesPanel({ manifest }: { manifest: ModuleManifest }) {
  const [tab, setTab] = useState<Tab>("installed");
  const [installed, setInstalled] = useState<Package[]>([]);
  const [upgradable, setUpgradable] = useState<Package[]>([]);
  const [results, setResults] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const isLocal = target.isLive; // remote agents also have `isLive = true`; we detect below

  const showToast = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async (which: Tab) => {
    setLoading(true);
    try {
      if (which === "installed") {
        const list = await target.packagesList();
        setInstalled(list);
      } else if (which === "upgradable") {
        const list = await target.packagesUpgradable();
        setUpgradable(list);
      }
    } catch (e) {
      showToast(false, `Load failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === "installed" && installed.length === 0) load("installed");
    if (tab === "upgradable" && upgradable.length === 0) load("upgradable");
  }, [tab, installed.length, upgradable.length, load]);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const list = await target.packagesSearch(q);
      setResults(list);
    } catch (e) {
      showToast(false, `Search failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  async function act(
    id: string,
    kind: "install" | "uninstall" | "upgrade",
    label: string,
  ) {
    if (kind !== "install" && !window.confirm(`${label} ${id}?`)) return;
    setBusyId(id);
    try {
      const fn: () => Promise<PackageActionResult> =
        kind === "install"
          ? () => target.packageInstall(id)
          : kind === "uninstall"
            ? () => target.packageUninstall(id)
            : () => target.packageUpgrade(id);
      const result = await fn();
      showToast(result.ok, result.ok ? `${label} succeeded` : `${label} failed (exit ${result.exit_code})`);
      // Refresh the tab we're on so the row reflects reality.
      if (tab === "installed") load("installed");
      if (tab === "upgradable") load("upgradable");
    } catch (e) {
      showToast(false, `${label} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  async function upgradeAll() {
    if (!window.confirm(`Upgrade all ${upgradable.length} package(s)? This can take a while.`)) return;
    setBusyId("__all__");
    try {
      const r = await target.packagesUpgradeAll();
      showToast(r.ok, r.ok ? "All upgrades complete" : `Upgrade-all failed (exit ${r.exit_code})`);
      load("upgradable");
      load("installed");
    } catch (e) {
      showToast(false, `Upgrade-all failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  const source = tab === "installed" ? installed : tab === "upgradable" ? upgradable : results;
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return source;
    return source.filter((p) =>
      [p.id, p.name, p.version, p.source].some((f) => f.toLowerCase().includes(q)),
    );
  }, [source, filter]);

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-1.5">
          {tab === "upgradable" && upgradable.length > 0 && isLocal && (
            <button
              type="button"
              onClick={upgradeAll}
              disabled={busyId !== null}
              className="focus-ring flex h-8 items-center gap-1.5 rounded-[9px] bg-[rgba(var(--raspberry-rgb),0.15)] px-2.5 text-[12px] font-medium text-raspberry transition-colors hover:bg-[rgba(var(--raspberry-rgb),0.25)] disabled:opacity-50"
            >
              {busyId === "__all__" ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpCircle size={13} />}
              Upgrade all
            </button>
          )}
          <button
            type="button"
            onClick={() => load(tab === "search" ? "installed" : tab)}
            disabled={loading}
            className="focus-ring flex h-8 items-center gap-1.5 rounded-[9px] bg-surface-hi px-2.5 text-[12px] text-text transition-colors hover:text-raspberry disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      }
    >
      {toast && (
        <div
          className={cn(
            "mb-3 flex items-center gap-2 rounded-[10px] px-3 py-2 text-[12px]",
            toast.ok
              ? "bg-[rgba(52,211,153,0.14)] text-emerald-300"
              : "bg-[rgba(255,80,80,0.14)] text-red-300",
          )}
        >
          {toast.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {toast.text}
        </div>
      )}

      <div className="mb-3 flex items-center gap-1">
        <TabButton active={tab === "installed"} onClick={() => setTab("installed")}>
          Installed{installed.length ? ` · ${installed.length}` : ""}
        </TabButton>
        <TabButton active={tab === "upgradable"} onClick={() => setTab("upgradable")}>
          Upgradable{upgradable.length ? ` · ${upgradable.length}` : ""}
        </TabButton>
        <TabButton active={tab === "search"} onClick={() => setTab("search")}>
          Search
        </TabButton>
      </div>

      {tab === "search" && (
        <div className="mb-3 flex items-center gap-2">
          <div className="focus-ring flex h-9 flex-1 items-center gap-2 rounded-[9px] bg-surface-hi px-3">
            <Search size={13} className="text-text-dim" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search winget catalog (e.g. neovim, ripgrep)…"
              className="h-full flex-1 bg-transparent text-[12px] text-text placeholder:text-text-dim focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={runSearch}
            disabled={loading || !query.trim()}
            className="focus-ring flex h-9 items-center gap-1.5 rounded-[9px] bg-[rgba(var(--raspberry-rgb),0.15)] px-3 text-[12px] font-medium text-raspberry disabled:opacity-40"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Search
          </button>
        </div>
      )}

      {tab !== "search" && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="focus-ring h-8 flex-1 rounded-[9px] bg-surface-hi px-3 text-[12px] text-text placeholder:text-text-dim"
          />
          <span className="mono text-[11px] text-text-dim">
            {filtered.length}/{source.length}
          </span>
        </div>
      )}

      <GlassPanel interactive={false} className="overflow-hidden">
        <div className="grid grid-cols-[1fr_240px_100px_100px_120px] items-center gap-2 border-b border-stroke px-3 py-2 text-[11px] uppercase tracking-wide text-text-dim">
          <span>Name</span>
          <span>ID</span>
          <span>Version</span>
          <span>{tab === "upgradable" ? "Available" : "Source"}</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
          {filtered.map((p) => (
            <div
              key={p.id + p.version}
              className="group grid grid-cols-[1fr_240px_100px_100px_120px] items-center gap-2 border-b border-[rgba(255,255,255,0.03)] px-3 py-2 text-[12px] hover:bg-surface-hi"
            >
              <span className="flex items-center gap-2 truncate text-text">
                <PackageIcon size={12} className="text-text-dim" />
                {p.name || <em className="not-italic text-text-dim">unnamed</em>}
              </span>
              <span className="mono truncate text-text-dim">{p.id}</span>
              <span className="mono truncate text-[11px] text-text-dim">{p.version}</span>
              <span className="mono truncate text-[11px]">
                {tab === "upgradable" && p.available ? (
                  <span className="text-emerald-400">{p.available}</span>
                ) : (
                  <span className="text-text-dim">{p.source || "—"}</span>
                )}
              </span>
              <span className="flex items-center justify-end gap-1">
                {isLocal ? (
                  <>
                    {tab === "upgradable" && (
                      <IconAction
                        label="Upgrade"
                        icon={<ArrowUpCircle size={12} />}
                        loading={busyId === p.id}
                        onClick={() => act(p.id, "upgrade", "Upgrade")}
                      />
                    )}
                    {tab === "search" && (
                      <IconAction
                        label="Install"
                        icon={<Download size={12} />}
                        loading={busyId === p.id}
                        onClick={() => act(p.id, "install", "Install")}
                      />
                    )}
                    {tab === "installed" && (
                      <IconAction
                        label="Uninstall"
                        icon={<Trash2 size={12} />}
                        loading={busyId === p.id}
                        onClick={() => act(p.id, "uninstall", "Uninstall")}
                        danger
                      />
                    )}
                  </>
                ) : (
                  <span className="text-[10.5px] text-text-dim">read-only</span>
                )}
              </span>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px] text-text-dim">
              {tab === "search" && !query.trim() && (
                <>Type something and hit <span className="text-raspberry">Enter</span> to search the winget catalog.</>
              )}
              {tab === "search" && query.trim() && "No matches — try a different query."}
              {tab === "installed" && "No packages found. Is winget installed?"}
              {tab === "upgradable" && (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  Everything up to date.
                </span>
              )}
            </div>
          )}
          {loading && filtered.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-text-dim">
              <Loader2 size={14} className="animate-spin text-raspberry" />
              Querying winget…
            </div>
          )}
        </div>
      </GlassPanel>
    </PanelShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring h-8 rounded-[8px] px-3 text-[12px] transition-colors",
        active
          ? "bg-[rgba(var(--raspberry-rgb),0.18)] text-raspberry"
          : "text-text-dim hover:bg-surface-hi hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function IconAction({
  label,
  icon,
  loading,
  onClick,
  danger,
}: {
  label: string;
  icon: React.ReactNode;
  loading: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={label}
      className={cn(
        "focus-ring inline-flex items-center gap-1 rounded-[7px] px-2 py-0.5 text-[11px] transition-colors disabled:opacity-40",
        danger
          ? "text-text-dim hover:bg-[rgba(255,80,80,0.18)] hover:text-red-300"
          : "text-text-dim hover:bg-[rgba(var(--raspberry-rgb),0.18)] hover:text-raspberry",
      )}
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}
