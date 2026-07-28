import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";

/** xterm theme tuned to the Raspberry palette. */
const THEME = {
  background: "#0b0b0d",
  foreground: "#f5f5f7",
  cursor: "#e11d48",
  cursorAccent: "#0b0b0d",
  selectionBackground: "rgba(225,29,72,0.30)",
  black: "#15151a",
  red: "#fb2c50",
  green: "#34d399",
  yellow: "#fbbf24",
  blue: "#38bdf8",
  magenta: "#7c3aed",
  cyan: "#22d3ee",
  white: "#cfcfd6",
  brightBlack: "#4b4b55",
  brightRed: "#fb2c50",
  brightGreen: "#6ee7b7",
  brightYellow: "#fde68a",
  brightBlue: "#7dd3fc",
  brightMagenta: "#a78bfa",
  brightCyan: "#67e8f9",
  brightWhite: "#ffffff",
};

/**
 * One live terminal, bound to a backend PTY session by `id`. Streams output in
 * via `term:data:<id>` events and sends keystrokes/resizes back through Tauri
 * commands. The session persists on the backend across tab switches (the view
 * only unmounts — and closes the PTY — when the tab is actually closed).
 */
export function TerminalView({
  id,
  shell,
  active,
}: {
  id: string;
  shell: string;
  active: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      theme: THEME,
      fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    let unlistenData: UnlistenFn | undefined;
    let unlistenExit: UnlistenFn | undefined;

    (async () => {
      unlistenData = await listen<string>(`term:data:${id}`, (e) => term.write(e.payload));
      unlistenExit = await listen(`term:exit:${id}`, () =>
        term.write("\r\n\x1b[2m— session ended —\x1b[0m\r\n"),
      );
      await invoke("terminal_open", { id, shell, cols: term.cols, rows: term.rows });
    })().catch((err) => term.write(`\r\n\x1b[31mFailed to open shell: ${err}\x1b[0m\r\n`));

    const onData = term.onData((data) => {
      invoke("terminal_write", { id, data }).catch(() => {});
    });

    const resize = new ResizeObserver(() => {
      try {
        fit.fit();
        invoke("terminal_resize", { id, cols: term.cols, rows: term.rows }).catch(() => {});
      } catch {
        /* container not measurable yet */
      }
    });
    resize.observe(container);

    return () => {
      resize.disconnect();
      onData.dispose();
      unlistenData?.();
      unlistenExit?.();
      invoke("terminal_close", { id }).catch(() => {});
      term.dispose();
    };
  }, [id, shell]);

  // Refit + focus when this tab becomes visible (a hidden xterm can't measure).
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      const term = termRef.current;
      try {
        fitRef.current?.fit();
        term?.focus();
        if (term) invoke("terminal_resize", { id, cols: term.cols, rows: term.rows }).catch(() => {});
      } catch {
        /* ignore */
      }
    }, 40);
    return () => clearTimeout(t);
  }, [active, id]);

  return <div ref={containerRef} className="h-full w-full" />;
}
