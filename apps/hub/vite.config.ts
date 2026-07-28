import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port and hides Vite's own error overlay when the
// TAURI_* env vars are present (set automatically by `tauri dev`).
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Mirror the "@/*" -> "src/*" alias from tsconfig so Vite resolves it too.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Prevent Vite from obscuring Rust errors.
  clearScreen: false,

  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 5174 }
      : undefined,
    watch: {
      // Don't watch the Rust build output.
      ignored: ["**/src-tauri/**"],
    },
  },

  // Produce assets Tauri's webview can load from the bundle root.
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
  },
});
