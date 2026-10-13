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
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        claude: {
          bg: '#1e1e1e', // Claude dark mode warm charcoal grey
          surface: '#262626',
          input: '#2b2b2b',
          border: '#383838',
          hover: '#333333',
        },
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
