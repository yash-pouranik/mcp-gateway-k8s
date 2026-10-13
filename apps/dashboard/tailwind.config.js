/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"EB Garamond"', 'serif', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"EB Garamond"', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        cf: {
          orange: '#f38020',
          hover: '#fa8c16',
          dark: '#c45e0f',
          glow: 'rgba(243, 128, 32, 0.15)',
        },
      },
    },
  },
  plugins: [],
}
