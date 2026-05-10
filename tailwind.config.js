/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0F19",
        card: "#121A2B",
        accent: "#5B8CFF",
        positive: "#16C47F",
        negative: "#FF4D4D",
        warning: "#FFB648"
      },
      boxShadow: {
        glow: "0 0 25px rgba(91, 140, 255, 0.35)"
      }
    }
  },
  plugins: []
};
