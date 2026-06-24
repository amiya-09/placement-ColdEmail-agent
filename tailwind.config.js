/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C1B19",
        paper: "#FAF9F6",
        line: "#E4E1D8",
        moss: "#3F5B47",
        clay: "#A8552E",
        muted: "#6B6A63",
      },
      fontFamily: {
        display: ["Georgia", "serif"],
        body: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
