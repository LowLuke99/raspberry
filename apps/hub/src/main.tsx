import React from "react";
import ReactDOM from "react-dom/client";

// Fonts (bundled — works offline in the Tauri webview, no CDN needed).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import "./styles/global.css";

// Side-effect import: registers every module in the registry before first paint.
import "./modules";

import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
