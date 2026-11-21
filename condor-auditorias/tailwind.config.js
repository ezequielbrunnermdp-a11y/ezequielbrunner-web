/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand-primary) / <alpha-value>)',
          accent: 'rgb(var(--brand-accent) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark) / <alpha-value>)',
        },
        crema: { 50: '#fcfaf6', 100: '#f7f1e7', 200: '#eee3d0', 300: '#e2d1b4' },
        cafe: { 400: '#9a7b5f', 500: '#7a5c42', 600: '#5e432f', 700: '#46311f', 800: '#2e2016', 900: '#1b130d' },
        oro: { 300: '#dcc48a', 400: '#c9a95c', 500: '#b08d3e', 600: '#8f7130' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(46,32,22,.06), 0 4px 16px rgba(46,32,22,.05)' },
    },
  },
  plugins: [],
};
