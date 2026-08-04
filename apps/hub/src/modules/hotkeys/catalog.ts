/**
 * Keyboard-shortcut catalog. Data-only — the panel renders from this.
 *
 * Add new shortcuts here; the panel picks them up automatically. Keys are
 * written in the natural cross-platform notation: `Ctrl`, `Shift`, `Alt`,
 * `Win`, `Tab`, `Enter`, `Esc`, letters/digits. Two-step chords use `,`
 * (e.g. `Ctrl+K, Ctrl+S` — press the second combo after the first).
 */
export type HotkeyGroup =
  | "windows"
  | "explorer"
  | "browser"
  | "vscode"
  | "terminal"
  | "powertoys"
  | "gaming"
  | "editing";

export interface Hotkey {
  keys: string;
  what: string;
  detail?: string;
  tags?: string[];
}

export interface HotkeySection {
  group: HotkeyGroup;
  title: string;
  subtitle: string;
  items: Hotkey[];
}

export const HOTKEY_GROUP_LABEL: Record<HotkeyGroup, string> = {
  windows: "Windows",
  explorer: "File Explorer",
  browser: "Browser",
  vscode: "VS Code",
  terminal: "Terminal",
  powertoys: "PowerToys",
  gaming: "Gaming",
  editing: "Text editing",
};

export const HOTKEYS: HotkeySection[] = [
  {
    group: "windows",
    title: "Windows 11 essentials",
    subtitle: "The system-wide shortcuts every Windows user should own.",
    items: [
      { keys: "Win", what: "Open Start menu" },
      { keys: "Win+D", what: "Show desktop / restore windows", detail: "Toggles the desktop — press once to minimize everything, again to bring windows back." },
      { keys: "Win+E", what: "Open File Explorer" },
      { keys: "Win+L", what: "Lock the computer" },
      { keys: "Win+I", what: "Open Settings" },
      { keys: "Win+X", what: "Power-user menu", detail: "Instant access to Terminal (Admin), Device Manager, Disk Management, Task Manager, and other system tools." },
      { keys: "Win+R", what: "Run dialog", detail: "Launch any app or file by name. Try 'cmd', 'regedit', 'notepad', 'ms-settings:'." },
      { keys: "Ctrl+Shift+Esc", what: "Task Manager", detail: "Skip Ctrl+Alt+Del — this opens Task Manager directly." },
      { keys: "Win+.", what: "Emoji + symbol picker", detail: "Also handles kaomoji, GIFs, and clipboard history." },
      { keys: "Win+V", what: "Clipboard history", detail: "Every recent copy is here. First time you press it, Windows asks to enable it." },
      { keys: "Win+Shift+S", what: "Snipping tool", detail: "Rectangular / free-form / window / full-screen screenshot to clipboard." },
      { keys: "Win+PrtScn", what: "Full screenshot to file", detail: "Saved to Pictures\\Screenshots automatically." },
      { keys: "Win+Tab", what: "Task view", detail: "See all open windows + virtual desktops on one grid." },
      { keys: "Win+Ctrl+D", what: "New virtual desktop" },
      { keys: "Win+Ctrl+←/→", what: "Switch virtual desktop" },
      { keys: "Win+Ctrl+F4", what: "Close current virtual desktop" },
      { keys: "Win+Z", what: "Snap layouts", detail: "Pick one of the preset window arrangements (Win 11)." },
      { keys: "Win+←/→", what: "Snap window left / right" },
      { keys: "Win+↑/↓", what: "Maximize / minimize" },
      { keys: "Win+Shift+←/→", what: "Move window to other monitor" },
      { keys: "Alt+Tab", what: "Switch between apps" },
      { keys: "Alt+F4", what: "Close current window", detail: "On the desktop it opens the shutdown dialog." },
      { keys: "Win+Space", what: "Cycle keyboard layout" },
      { keys: "Win+A", what: "Quick settings", detail: "Wi-Fi, Bluetooth, focus, brightness, volume." },
      { keys: "Win+N", what: "Notification center + calendar" },
      { keys: "Win+G", what: "Xbox Game Bar", detail: "Overlay for recording, screenshotting, FPS counter — works in most apps, not just games." },
      { keys: "Win+P", what: "Projection settings", detail: "Duplicate / extend / second screen only." },
      { keys: "Win+Pause", what: "About This PC (System page)" },
      { keys: "Win+U", what: "Accessibility settings" },
      { keys: "Win+; then S", what: "Voice typing", detail: "System-wide speech-to-text into any text field." },
    ],
  },
  {
    group: "explorer",
    title: "File Explorer",
    subtitle: "Browse, rename, and act on files without touching the mouse.",
    items: [
      { keys: "Ctrl+N", what: "New window" },
      { keys: "Ctrl+W", what: "Close window" },
      { keys: "Ctrl+E", what: "Focus address bar" },
      { keys: "Ctrl+F", what: "Focus search box" },
      { keys: "Ctrl+L", what: "Show + edit full path" },
      { keys: "Alt+↑", what: "Go up one folder" },
      { keys: "Alt+←/→", what: "Back / forward" },
      { keys: "F2", what: "Rename selected" },
      { keys: "F3", what: "Search current folder" },
      { keys: "F4", what: "Toggle address bar dropdown" },
      { keys: "F5", what: "Refresh" },
      { keys: "F6", what: "Cycle panes" },
      { keys: "Ctrl+Shift+N", what: "New folder" },
      { keys: "Ctrl+Shift+E", what: "Expand nav pane to current folder" },
      { keys: "Shift+Right-click", what: "Extended context menu", detail: "Reveals 'Copy as path', 'Open PowerShell here', and others hidden by default." },
      { keys: "Shift+Del", what: "Permanent delete (skip Recycle Bin)" },
      { keys: "Alt+P", what: "Toggle preview pane" },
      { keys: "Alt+Enter", what: "Show properties" },
      { keys: "Ctrl+Mouse wheel", what: "Change view density", detail: "Icons / small / medium / large / details." },
    ],
  },
  {
    group: "browser",
    title: "Browser (Chrome / Edge / Firefox / Brave)",
    subtitle: "Move around the web without the mouse. Nearly identical across major browsers.",
    items: [
      { keys: "Ctrl+T", what: "New tab" },
      { keys: "Ctrl+W", what: "Close tab" },
      { keys: "Ctrl+Shift+T", what: "Reopen closed tab", detail: "Keeps working — hold to reopen the last 10." },
      { keys: "Ctrl+N", what: "New window" },
      { keys: "Ctrl+Shift+N", what: "New incognito / private window" },
      { keys: "Ctrl+Tab", what: "Next tab" },
      { keys: "Ctrl+Shift+Tab", what: "Previous tab" },
      { keys: "Ctrl+1..8", what: "Jump to tab 1-8" },
      { keys: "Ctrl+9", what: "Jump to last tab" },
      { keys: "Ctrl+L", what: "Focus address bar" },
      { keys: "Ctrl+K", what: "Focus search box (or start a search)" },
      { keys: "Ctrl+F", what: "Find on page" },
      { keys: "Ctrl+G", what: "Next match" },
      { keys: "Ctrl+Shift+G", what: "Previous match" },
      { keys: "Ctrl+D", what: "Bookmark this page" },
      { keys: "Ctrl+H", what: "History" },
      { keys: "Ctrl+J", what: "Downloads" },
      { keys: "Ctrl+Shift+Del", what: "Clear browsing data dialog" },
      { keys: "Ctrl+U", what: "View page source" },
      { keys: "F12", what: "DevTools" },
      { keys: "Ctrl+Shift+I", what: "DevTools (alt)" },
      { keys: "Ctrl+Shift+C", what: "DevTools: inspect-element mode" },
      { keys: "Ctrl+0", what: "Reset zoom" },
      { keys: "Ctrl+ / Ctrl-", what: "Zoom in / out" },
      { keys: "Space / Shift+Space", what: "Scroll down / up by page" },
      { keys: "Home / End", what: "Top / bottom of page" },
    ],
  },
  {
    group: "vscode",
    title: "VS Code",
    subtitle: "The editor's real superpowers live in these shortcuts.",
    items: [
      { keys: "Ctrl+P", what: "Quick open file", detail: "Fuzzy-find any file in the workspace. Add ':' + line number to jump." },
      { keys: "Ctrl+Shift+P", what: "Command palette", detail: "Every command in the editor — start typing what you want to do." },
      { keys: "Ctrl+`", what: "Toggle integrated terminal" },
      { keys: "Ctrl+B", what: "Toggle sidebar" },
      { keys: "Ctrl+J", what: "Toggle bottom panel" },
      { keys: "Ctrl+/", what: "Toggle line comment" },
      { keys: "Ctrl+D", what: "Select next occurrence of selection" },
      { keys: "Alt+Click", what: "Add cursor at click position", detail: "The gateway drug to multi-cursor editing." },
      { keys: "Ctrl+Alt+↑/↓", what: "Add cursor above / below" },
      { keys: "Alt+↑/↓", what: "Move line up / down" },
      { keys: "Shift+Alt+↑/↓", what: "Copy line up / down" },
      { keys: "Ctrl+Enter", what: "New line below" },
      { keys: "Ctrl+Shift+Enter", what: "New line above" },
      { keys: "Ctrl+Shift+K", what: "Delete line" },
      { keys: "Ctrl+G", what: "Go to line" },
      { keys: "F12", what: "Go to definition" },
      { keys: "Alt+F12", what: "Peek definition" },
      { keys: "Shift+F12", what: "Find all references" },
      { keys: "F2", what: "Rename symbol", detail: "Refactors every use across the project." },
      { keys: "Ctrl+.", what: "Quick fix / code action" },
      { keys: "Ctrl+K, Ctrl+S", what: "Open keyboard shortcuts editor" },
      { keys: "Ctrl+K, Z", what: "Zen mode (distraction-free)" },
      { keys: "Ctrl+\\", what: "Split editor" },
    ],
  },
  {
    group: "terminal",
    title: "Windows Terminal / PowerShell",
    subtitle: "Move around inside a shell without lifting your hands.",
    items: [
      { keys: "Ctrl+T", what: "New tab (Windows Terminal)" },
      { keys: "Ctrl+Shift+T", what: "Reopen closed tab" },
      { keys: "Ctrl+Tab", what: "Next tab" },
      { keys: "Ctrl+Shift+D", what: "Duplicate tab" },
      { keys: "Alt+Shift+D", what: "Split pane" },
      { keys: "Alt+↑/↓/←/→", what: "Focus pane" },
      { keys: "Ctrl+Shift+F", what: "Search terminal buffer" },
      { keys: "Ctrl+C", what: "Cancel current command", detail: "In readline, also clears the input line." },
      { keys: "Ctrl+L", what: "Clear screen" },
      { keys: "Ctrl+R", what: "Reverse-search history (bash / PSReadLine)" },
      { keys: "↑ / ↓", what: "Previous / next command" },
      { keys: "Ctrl+←/→", what: "Move by word" },
      { keys: "Ctrl+U", what: "Cut to start of line" },
      { keys: "Ctrl+K", what: "Cut to end of line" },
      { keys: "Ctrl+A", what: "Jump to start of line" },
      { keys: "Ctrl+E", what: "Jump to end of line" },
      { keys: "Ctrl+D", what: "Exit shell / EOF" },
      { keys: "Tab", what: "Autocomplete", detail: "PowerShell + bash + zsh all cycle through completions." },
    ],
  },
  {
    group: "powertoys",
    title: "PowerToys",
    subtitle: "Microsoft's open-source power-user pack. Install once, then these come alive.",
    items: [
      { keys: "Alt+Space", what: "PowerToys Run", detail: "Spotlight-style launcher. Type an app name, calc, unit convert, kill process, run shell command." },
      { keys: "Win+Shift+T", what: "Text Extractor (OCR)", detail: "Screenshot a region and grab its text into the clipboard — even from images, PDFs, videos." },
      { keys: "Win+Shift+C", what: "Color Picker" },
      { keys: "Win+Shift+/", what: "Shortcut Guide", detail: "Holds an overlay of every Win-key shortcut while pressed." },
      { keys: "Win+Ctrl+V", what: "Advanced Paste (paste as plain / markdown / JSON)" },
      { keys: "Win+`", what: "Workspaces", detail: "Save + restore an entire set of open apps and window positions." },
      { keys: "Ctrl+Win+Alt+H", what: "Hosts File Editor" },
    ],
  },
  {
    group: "editing",
    title: "Text editing (everywhere)",
    subtitle: "System-wide shortcuts that work in Notepad, browsers, Word, chat boxes — anywhere you type.",
    items: [
      { keys: "Ctrl+C / X / V", what: "Copy / cut / paste" },
      { keys: "Ctrl+Z", what: "Undo" },
      { keys: "Ctrl+Y (or Ctrl+Shift+Z)", what: "Redo" },
      { keys: "Ctrl+A", what: "Select all" },
      { keys: "Ctrl+←/→", what: "Move by word" },
      { keys: "Ctrl+Shift+←/→", what: "Select by word" },
      { keys: "Ctrl+Backspace", what: "Delete previous word" },
      { keys: "Ctrl+Del", what: "Delete next word" },
      { keys: "Shift+←/→/↑/↓", what: "Extend selection" },
      { keys: "Home / End", what: "Jump to start / end of line" },
      { keys: "Ctrl+Home / End", what: "Jump to start / end of document" },
      { keys: "Shift+Enter", what: "Line break (in most chat / form fields)" },
      { keys: "Ctrl+Shift+V", what: "Paste as plain text (most apps)" },
    ],
  },
  {
    group: "gaming",
    title: "Gaming (Xbox Game Bar)",
    subtitle: "Game Bar is more than just for games — it captures screenshots + video from most apps.",
    items: [
      { keys: "Win+G", what: "Open Game Bar overlay" },
      { keys: "Win+Alt+PrtScn", what: "Screenshot the current game" },
      { keys: "Win+Alt+R", what: "Start / stop recording" },
      { keys: "Win+Alt+G", what: "Record last 30 seconds", detail: "Requires background recording enabled in Game Bar settings." },
      { keys: "Win+Alt+M", what: "Mute microphone during recording" },
      { keys: "Win+Alt+B", what: "Turn HDR on / off" },
    ],
  },
];
