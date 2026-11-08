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
          navy: 'rgb(var(--brand-navy) / <alpha-value>)',
          teal: 'rgb(var(--brand-teal) / <alpha-value>)',
          gold: 'rgb(var(--brand-gold) / <alpha-value>)',
          bg: 'rgb(var(--brand-bg) / <alpha-value>)',
          header: 'rgb(var(--brand-header) / <alpha-value>)',
          sidebar: 'rgb(var(--brand-sidebar) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark) / <alpha-value>)',
          muted: 'rgb(var(--brand-muted) / <alpha-value>)',
          paper: 'rgb(var(--brand-paper) / <alpha-value>)',
          'paper-tint': 'rgb(var(--brand-paper-tint) / <alpha-value>)',
          'gold-light': 'rgb(var(--brand-gold-light) / <alpha-value>)',
          'teal-light': 'rgb(var(--brand-teal-light) / <alpha-value>)',
          'navy-light': 'rgb(var(--brand-navy-light) / <alpha-value>)',
        },
      },
      borderColor: {
        'brand-dark': 'rgb(var(--brand-border) / <alpha-value>)',
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
