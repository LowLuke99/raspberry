import { useEffect } from "react";
import { AppShell } from "@/layout/AppShell";
import { CommandPalette } from "@/command/CommandPalette";
import { useAppStore } from "@/state/useAppStore";

export default function App() {
  const toggleCommand = useAppStore((s) => s.toggleCommand);

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

  return (
    <>
      <AppShell />
      <CommandPalette />
    </>
  );
}
