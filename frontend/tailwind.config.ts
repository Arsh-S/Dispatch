import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        dispatch: {
          charcoal: "#1a1d21",
          slate: "#252a31",
          muted: "#3d4550",
          blue: "#3b82f6",
          yellow: "#eab308",
          green: "#22c55e",
          red: "#ef4444",
          orange: "#f97316",
          purple: "#a855f7",
          teal: "#14b8a6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
