import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        panel: "var(--panel)",
        line: "var(--line)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        ink: "var(--ink)",
        muted: "var(--muted)",
      },
      boxShadow: {
        panel: "0 14px 44px rgba(0, 0, 0, .2)",
      },
    },
  },
  plugins: [],
} satisfies Config;
