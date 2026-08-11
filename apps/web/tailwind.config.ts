import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12151B",
        paper: "#FAF8F3",
        accent: "#2F3A8F",
        "accent-light": "#4552B8",
        alert: "#C98A2C",
        line: "#D8D3C7",
        muted: "#6B6A63",
        danger: "#B3462C",
        success: "#2F6B4F",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
