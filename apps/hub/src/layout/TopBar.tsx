import { Search, Bell, Settings, ChevronDown } from "lucide-react";
import { useAppStore } from "@/state/useAppStore";
import { RaspberryLogo } from "@/ui/Logo";
import { IconButton } from "@/ui/IconButton";
import { MachineChip } from "./MachineChip";
import pkg from "../../package.json";

const APP_VERSION = (pkg as { version: string }).version;

/**
 * Top bar (spec §6): brand, active-machine chip, Ctrl+K search trigger,
 * workspace selector, notifications, settings. Draggable region so the frameless
 * Tauri window can be moved by the bar (data-tauri-drag-region).
 */
export function TopBar() {
  const openCommand = useAppStore((s) => s.setCommandOpen);

  return (
    <header
      data-tauri-drag-region
      className="flex items-center gap-3 px-3"
      style={{ height: "var(--topbar-h)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 pl-1 pr-2">
        <RaspberryLogo size={22} />
        <span className="text-[14px] font-semibold tracking-tight text-text">
          Raspberry
        </span>
        <span
          className="mono rounded-[5px] bg-surface-hi px-1.5 py-0.5 text-[10px] text-text-dim"
          title={`Raspberry v${APP_VERSION}`}
        >
          v{APP_VERSION}
        </span>
      </div>

      <MachineChip />

      {/* Command palette trigger — grows to fill, the shell's search bar. */}
      <button
        type="button"
        onClick={() => openCommand(true)}
        className="focus-ring glass group ml-1 flex h-9 max-w-[420px] flex-1 items-center gap-2 rounded-[10px] px-3 text-left"
        aria-label="Open command palette"
      >
        <Search size={15} className="text-text-dim" />
        <span className="flex-1 text-[12.5px] text-text-dim">
          Search or run a command…
        </span>
        <kbd className="mono rounded-[6px] bg-surface-hi px-1.5 py-0.5 text-[10px] text-text-dim shadow-[var(--hairline)]">
          Ctrl K
        </kbd>
      </button>

      {/* Workspace selector (placeholder for now). */}
      <button
        type="button"
        className="focus-ring flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] text-text-dim transition-colors hover:bg-surface-hi hover:text-text"
        aria-label="Switch workspace"
      >
        <span>Default</span>
        <ChevronDown size={13} />
      </button>

      <div className="flex items-center gap-1">
        <IconButton label="Notifications">
          <Bell size={17} strokeWidth={1.75} />
        </IconButton>
        <IconButton label="Settings">
          <Settings size={17} strokeWidth={1.75} />
        </IconButton>
      </div>
    </header>
  );
}
