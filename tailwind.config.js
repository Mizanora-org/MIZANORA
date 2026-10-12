/** @type {import('tailwindcss').Config} */
// Colour names are kept from the first version so every page keeps working:
//   gold = main brand colour (deep emerald), saffron = deal/accent colour,
//   ink = page background, surface = white cards, cream = main text.
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#F2F4EF', surface: '#FFFFFF', raised: '#E9EDE6', line: '#DCE1D6',
        gold: '#0B6B45', goldhi: '#085A39', bronze: '#E8A317', saffron: '#F29F05',
        cream: '#12201A', dim: '#46544C', faint: '#66736B', wa: '#25D366',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-arabic)', 'Amiri', 'serif'],
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: { marquee: 'marquee var(--mq-dur, 40s) linear infinite' },
    },
  },
  plugins: [],
};
