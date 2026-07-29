import { useEffect } from "react";
import { AppShell } from "@/layout/AppShell";
import { CommandPalette } from "@/command/CommandPalette";
import { useAppStore } from "@/state/useAppStore";
import { bus } from "@/lib/bus";
import { moduleManifests } from "@/modules/manifests";

export default function App() {
  const toggleCommand = useAppStore((s) => s.toggleCommand);
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);

  // Global Ctrl+K (⌘K on mac) toggles the command palette (spec §8).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggleCommand();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCommand]);

  // Cross-module navigation: any module can ask us to switch panels.
  useEffect(() => {
    return bus.on("nav:go", ({ moduleId }) => {
      const m = moduleManifests.find((x) => x.id === moduleId);
      if (m) setActiveRoute(m.route);
    });
  }, [setActiveRoute]);

  return (
    <>
      <AppShell />
      <CommandPalette />
    </>
  );
}
