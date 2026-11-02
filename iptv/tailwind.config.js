/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#04100a',
        panel: '#08170f',
        raised: '#0c211629',
        line: 'rgba(255,255,255,.10)',
        gold: '#f5b83d',
        goldsoft: '#ffe2a4',
        emerald: '#14b87a',
        emeraldsoft: '#7cf3c1',
        cream: '#f2f7f3',
        dim: 'rgba(226,240,232,.62)',
        faint: 'rgba(226,240,232,.38)',
        danger: '#ff5a6a',
        info: '#4cc3ff',
        violet: '#a78bfa',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      // Extra opacity steps used across the panel (Tailwind's default scale has no 8/12/15/35/45/55/65/85).
      opacity: { 2: '0.02', 3: '0.03', 4: '0.04', 6: '0.06', 7: '0.07', 8: '0.08', 12: '0.12', 15: '0.15', 18: '0.18', 35: '0.35', 45: '0.45', 55: '0.55', 65: '0.65', 85: '0.85' },
      boxShadow: {
        glow: '0 20px 60px -28px rgba(20,184,122,.65)',
        goldglow: '0 20px 60px -28px rgba(245,184,61,.55)',
        panel: '0 24px 60px -32px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.05)',
      },
      borderRadius: { xl2: '20px' },
    },
  },
  plugins: [],
};
