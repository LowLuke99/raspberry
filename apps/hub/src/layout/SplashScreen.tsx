import { useEffect, useRef, useState } from "react";

/**
 * First-run splash: plays the Kling raspberry animation over the matte-black
 * backdrop, then fades to the shell. Shown once per session (or until the user
 * clicks past it). If the media fails to load the shell still comes up — this
 * never blocks the app.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    // in → hold → out → done
    timers.current.push(window.setTimeout(() => setPhase("hold"), 300));
    timers.current.push(window.setTimeout(() => setPhase("out"), 2400));
    timers.current.push(window.setTimeout(() => onDone(), 3000));
    return () => timers.current.forEach(clearTimeout);
  }, [onDone]);

  const opacity = phase === "in" ? 0 : phase === "hold" ? 1 : 0;

  return (
    <div
      onClick={onDone}
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--bg)",
        display: "grid",
        placeItems: "center",
        opacity,
        transition: "opacity 500ms var(--ease-out)",
        cursor: "pointer",
        pointerEvents: phase === "out" ? "none" : "auto",
      }}
      aria-label="Raspberry"
    >
      <img
        src="/media/splash.webp"
        alt=""
        width={360}
        height={360}
        style={{
          borderRadius: "22%",
          boxShadow: "0 20px 80px rgba(225,29,72,0.35), 0 0 120px rgba(124,58,237,0.25)",
          display: "block",
        }}
        onError={(e) => {
          // WebP unsupported → fall back to static PNG
          (e.currentTarget as HTMLImageElement).src = "/raspberry-512.png";
        }}
        draggable={false}
      />
    </div>
  );
}
