/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#082B4C',
          teal: '#0BA7B4',
          gold: '#F5A623',
          bg: '#F6FAFB',
          dark: '#172B3A',
          muted: '#4A6277',
          paper: '#FFFFFF',
          'paper-tint': '#F0F6F8',
          'gold-light': '#FEF7EC',
          'teal-light': '#EDF9FA',
          'navy-light': '#EDF3F7',
        },
      },
      boxShadow: {
        'brutal-xs': '2px 2px 0px 0px #172B3A',
        'brutal-sm': '3px 3px 0px 0px #172B3A',
        'brutal': '4px 4px 0px 0px #172B3A',
        'brutal-lg': '6px 6px 0px 0px #172B3A',
        'brutal-xl': '8px 8px 0px 0px #172B3A',
        'brutal-navy': '4px 4px 0px 0px #082B4C',
        'brutal-gold': '4px 4px 0px 0px #F5A623',
        'brutal-teal': '4px 4px 0px 0px #0BA7B4',
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
