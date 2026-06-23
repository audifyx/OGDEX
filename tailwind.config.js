/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0b0f",
        panel: "#12141c",
        panel2: "#181b25",
        line: "#232733",
        accent: "#22d3a6",
        accent2: "#7c5cff",
        up: "#16c784",
        down: "#ea3943",
        muted: "#8b93a7",
      },
      fontFamily: { mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"] },
    },
  },
  plugins: [],
};
