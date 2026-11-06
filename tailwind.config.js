/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: 'var(--brand-navy)',
          teal: 'var(--brand-teal)',
          gold: 'var(--brand-gold)',
          bg: 'var(--brand-bg)',
          dark: 'var(--brand-dark)',
          muted: 'var(--brand-muted)',
          paper: 'var(--brand-paper)',
          'paper-tint': 'var(--brand-paper-tint)',
          'gold-light': 'var(--brand-gold-light)',
          'teal-light': 'var(--brand-teal-light)',
          'navy-light': 'var(--brand-navy-light)',
        },
      },
      borderColor: {
        'brand-dark': 'var(--brand-border)',
      },
      boxShadow: {
        'brutal-xs': '2px 2px 0px 0px var(--brand-shadow)',
        'brutal-sm': '3px 3px 0px 0px var(--brand-shadow)',
        'brutal': '4px 4px 0px 0px var(--brand-shadow)',
        'brutal-lg': '6px 6px 0px 0px var(--brand-shadow)',
        'brutal-xl': '8px 8px 0px 0px var(--brand-shadow)',
        'brutal-navy': '4px 4px 0px 0px var(--brand-navy)',
        'brutal-gold': '4px 4px 0px 0px var(--brand-gold)',
        'brutal-teal': '4px 4px 0px 0px var(--brand-teal)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        heading: ['Space Grotesk', 'Plus Jakarta Sans', 'sans-serif'],
        mono: ['Space Mono', 'ui-monospace', 'monospace'],
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
}
