/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
      colors: {
        bg: v('bg'), surface: v('surface'), 'surface-2': v('surface-2'), line: v('line'),
        ink: v('ink'), 'ink-2': v('ink-2'), 'ink-3': v('ink-3'),
        accent: v('accent'), 'accent-ink': v('accent-ink'), 'accent-soft': v('accent-soft'),
        ok: v('ok'), 'ok-soft': v('ok-soft'), warn: v('warn'), 'warn-soft': v('warn-soft'),
        bad: v('bad'), 'bad-soft': v('bad-soft'), info: v('info'), 'info-soft': v('info-soft'),
      },
      borderRadius: { xl: '14px', '2xl': '18px' },
      boxShadow: {
        card: '0 1px 0 rgb(0 0 0 / 0.02), 0 1px 3px rgb(30 20 10 / 0.06)',
        pop: '0 10px 30px -10px rgb(30 20 10 / 0.25), 0 2px 6px rgb(30 20 10 / 0.08)',
      },
      fontSize: { '2xs': ['0.6875rem', '1rem'] },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'sheet-in': { from: { transform: 'translateY(16px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
      },
      animation: { 'fade-in': 'fade-in 160ms ease-out', 'sheet-in': 'sheet-in 200ms cubic-bezier(.2,.8,.2,1)' },
    },
  },
  plugins: [],
};
