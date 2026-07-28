import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { StatusBar } from "./StatusBar";

/**
 * The window frame: top bar, then a middle row of [rail | workspace], then the
 * status bar. Fixed-height chrome top and bottom; the workspace flexes to fill.
 * The whole thing sits on the ambient matte-black backdrop from global.css.
 */
export function AppShell() {
  return (
    <div className="flex h-full w-full flex-col">
      <TopBar />

      <div className="flex min-h-0 flex-1 gap-2 px-2 pb-1">
        <Sidebar />
        <main className="glass flex min-w-0 flex-1 overflow-hidden">
          <Workspace />
        </main>
      </div>

      <StatusBar />
    </div>
  );
}
