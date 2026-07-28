import { useCallback, useEffect, useState } from "react";
import { ArrowUp, Folder, File as FileIcon, HardDrive, Home } from "lucide-react";
import type { ModuleManifest } from "@/modules/types";
import type { FileEntry } from "@/target";
import { target } from "@/target";
import { PanelShell } from "@/ui/PanelShell";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/cn";

/** File Manager (spec §10.6): browse the local tree. Cross-machine transfer and
 *  duplicate/hash tools land in later phases; this is the navigation spine. */
export function FilesPanel({ manifest }: { manifest: ModuleManifest }) {
  const [path, setPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [roots, setRoots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initial location: home directory + drive roots.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [home, drives] = await Promise.all([target.homeDir(), target.roots()]);
      if (!alive) return;
      setRoots(drives);
      setPath(home);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load the directory whenever the path changes.
  useEffect(() => {
    if (path == null) return;
    let alive = true;
    setLoading(true);
    setError(null);
    target
      .listDir(path)
      .then((list) => {
        if (alive) setEntries(list);
      })
      .catch((e: unknown) => {
        if (alive) {
          setEntries([]);
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  const goUp = useCallback(() => {
    if (!path) return;
    const trimmed = path.replace(/[\\/]+$/, "");
    const idx = Math.max(trimmed.lastIndexOf("\\"), trimmed.lastIndexOf("/"));
    if (idx <= 0) return;
    const parent = trimmed.slice(0, idx + 1);
    setPath(parent);
  }, [path]);

  return (
    <PanelShell
      manifest={manifest}
      right={
        <div className="flex items-center gap-1">
          <ToolbarBtn label="Home" onClick={() => target.homeDir().then(setPath)}>
            <Home size={15} />
          </ToolbarBtn>
          <ToolbarBtn label="Up" onClick={goUp}>
            <ArrowUp size={15} />
          </ToolbarBtn>
        </div>
      }
    >
      {/* drive roots */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {roots.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setPath(r)}
            className="glass flex items-center gap-1.5 rounded-[9px] px-2.5 py-1 text-[12px] text-text-dim transition-colors hover:text-text"
          >
            <HardDrive size={13} /> {r}
          </button>
        ))}
      </div>

      {/* current path */}
      <div className="glass mb-3 truncate px-3 py-2 text-[12px] text-text-dim">
        <span className="mono text-text">{path ?? "…"}</span>
      </div>

      {error && (
        <div className="glass mb-3 px-3 py-2 text-[12px] text-raspberry">{error}</div>
      )}

      <div className="glass overflow-hidden">
        {loading && entries.length === 0 ? (
          <div className="px-3 py-6 text-center text-[13px] text-text-dim">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="px-3 py-6 text-center text-[13px] text-text-dim">Empty folder.</div>
        ) : (
          <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
            {entries.map((e) => (
              <button
                key={e.path}
                type="button"
                onDoubleClick={() => e.is_dir && setPath(e.path)}
                onClick={() => e.is_dir && setPath(e.path)}
                className={cn(
                  "grid w-full grid-cols-[1fr_110px] items-center gap-2 border-b border-[rgba(255,255,255,0.03)] px-3 py-1.5 text-left text-[12px] hover:bg-surface-hi",
                  e.is_dir ? "cursor-pointer" : "cursor-default",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={e.is_dir ? "text-raspberry" : "text-text-dim"}>
                    {e.is_dir ? <Folder size={15} /> : <FileIcon size={15} />}
                  </span>
                  <span className="truncate text-text">{e.name}</span>
                </span>
                <span className="mono text-right text-text-dim">
                  {e.is_dir ? "—" : formatBytes(e.size)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

function ToolbarBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="focus-ring grid h-8 w-8 place-items-center rounded-[9px] text-text-dim transition-colors hover:bg-surface-hi hover:text-text"
    >
      {children}
    </button>
  );
}
