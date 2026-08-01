import { useState } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { Workspace } from "./Workspace";
import { StatusBar } from "./StatusBar";
import { SplashScreen } from "./SplashScreen";

const SPLASH_KEY = "raspberry.splash.seen";

/**
 * The window frame: top bar, then a middle row of [rail | workspace], then the
 * status bar. Fixed-height chrome top and bottom; the workspace flexes to fill.
 * The whole thing sits on the ambient matte-black backdrop from global.css.
 *
 * First launch (and after every full app restart) plays the Kling splash
 * animation. Session-scoped so the splash isn't a nag on quick reopens.
 */
export function AppShell() {
  const [showSplash, setShowSplash] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(SPLASH_KEY) !== "1"
  );

  return (
    <div className="flex h-full w-full flex-col">
      {showSplash && (
        <SplashScreen
          onDone={() => {
            sessionStorage.setItem(SPLASH_KEY, "1");
            setShowSplash(false);
          }}
        />
      )}

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
