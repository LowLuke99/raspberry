/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Everything maps back to the CSS-variable tokens in src/styles/tokens.css,
      // so the design system has a single source of truth and can be re-themed
      // without touching component classes.
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-hi": "var(--surface-hi)",
        raspberry: {
          DEFAULT: "var(--raspberry)",
          hi: "var(--raspberry-hi)",
        },
        purple: {
          DEFAULT: "var(--purple)",
        },
        text: {
          DEFAULT: "var(--text)",
          dim: "var(--text-dim)",
        },
        stroke: "var(--stroke)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Cascadia Code'", "monospace"],
      },
      borderRadius: {
        panel: "16px",
      },
      boxShadow: {
        glow: "var(--glow)",
        panel: "0 8px 40px rgba(0,0,0,0.45)",
      },
      backdropBlur: {
        glass: "24px",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
