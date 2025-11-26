/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bitebox: {
          DEFAULT: "#6A24A4",
          light: "#8550C0",
          dark: "#4A1774",
        },
      },
    },
  },
  plugins: [],
}

