import { LayoutGrid, Terminal, Gauge, Radar } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { bus } from "@/lib/bus";
import { cn } from "@/lib/cn";

type Section = {
  id: string;
  jumpTo: string;
  label: string;
  tagline: string;
  icon: LucideIcon;
  image: string;
};

const SECTIONS: readonly Section[] = [
  {
    id: "deck",
    jumpTo: "command-deck",
    label: "Deck",
    tagline: "Live vitals & jump grid",
    icon: LayoutGrid,
    image: "/section-heroes/deck.webp",
  },
  {
    id: "shell",
    jumpTo: "terminal",
    label: "Shell",
    tagline: "Terminal · Commands · Packages",
    icon: Terminal,
    image: "/section-heroes/shell.webp",
  },
  {
    id: "system",
    jumpTo: "system-monitor",
    label: "System",
    tagline: "Vitals · Processes · Storage · Logs",
    icon: Gauge,
    image: "/section-heroes/system.webp",
  },
  {
    id: "network",
    jumpTo: "lan-manager",
    label: "Network",
    tagline: "LAN · Devices · Send · Identity",
    icon: Radar,
    image: "/section-heroes/network.webp",
  },
];

/**
 * Cinematic section entry tiles on the Command Deck. Each tile shows a
 * Kling-generated hero image with a matte-black gradient overlay, a section
 * icon, label, and tagline. Clicking a tile navigates to the canonical
 * starting module for that section via the shared nav bus.
 */
export function SectionHeroRow() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {SECTIONS.map((s) => (
        <SectionTile key={s.id} section={s} />
      ))}
    </div>
  );
}

function SectionTile({ section }: { section: Section }) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={() => bus.emit("nav:go", { moduleId: section.jumpTo })}
      aria-label={`${section.label} — ${section.tagline}`}
      className={cn(
        "focus-ring group relative overflow-hidden rounded-[14px] text-left",
        "aspect-[3/2] shadow-[var(--hairline),0_10px_36px_rgba(0,0,0,0.5)]",
        "transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:-translate-y-0.5",
      )}
    >
      {/* Background image */}
      <img
        src={section.image}
        alt=""
        aria-hidden
        loading="lazy"
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "group-hover:scale-[1.04]",
        )}
        draggable={false}
      />

      {/* Bottom-up matte-black gradient for legibility */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,15,0.15) 0%, rgba(10,10,15,0.30) 45%, rgba(10,10,15,0.85) 100%)",
        }}
      />

      {/* Rim accent that lights on hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[14px]"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 -1px 0 rgba(251,44,80,0.0)",
        }}
      />

      {/* Content */}
      <div className="relative flex h-full flex-col justify-between p-4">
        <div
          className={cn(
            "grid h-9 w-9 place-items-center rounded-[9px]",
            "bg-[rgba(10,10,15,0.55)] text-text shadow-[var(--hairline)]",
            "backdrop-blur-sm transition-colors",
            "group-hover:text-raspberry",
          )}
        >
          <Icon size={17} strokeWidth={1.75} />
        </div>

        <div>
          <div className="text-[17px] font-semibold tracking-tight text-text">
            {section.label}
          </div>
          <div className="mono mt-0.5 text-[10.5px] uppercase tracking-wider text-text-dim">
            {section.tagline}
          </div>
        </div>
      </div>
    </button>
  );
}
