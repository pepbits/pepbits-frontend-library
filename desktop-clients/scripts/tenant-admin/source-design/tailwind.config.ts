import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        spruce: {
          50: '#EAF2F0', 100: '#D3E4E0', 200: '#A9CAC2', 300: '#7BAAA0', 400: '#4F877C',
          500: '#30685E', 600: '#215249', 700: '#18413A', 800: '#12352F', 900: '#0E2F2C', 950: '#091F1D',
        },
        canvas: '#ECF0EE',
        mist: '#F6F8F7',
        line: '#D5DDDA',
        muted: '#5B6B68',
        saffron: { 50: '#FDF6E7', 100: '#FAE9C2', 400: '#ECBC55', 500: '#E3A72F', 600: '#C48A17', 700: '#94670F' },
        jade: { 50: '#E8F4EE', 100: '#CDE7DA', 500: '#2E8C6A', 600: '#1F7A5C', 700: '#16604A' },
        cobalt: { 50: '#EBF0F9', 100: '#D3DEF1', 500: '#3E6CB8', 600: '#2F5DA8', 700: '#264B88' },
        madder: { 50: '#FBECEB', 100: '#F4CFCD', 500: '#C43D39', 600: '#B4322F', 700: '#8F2724' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Public Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        rail: '8px 0 32px -12px rgba(9, 31, 29, 0.45)',
        drawer: '-24px 0 48px -24px rgba(9, 31, 29, 0.35)',
        pop: '0 12px 32px -12px rgba(9, 31, 29, 0.28)',
      },
      keyframes: {
        'drawer-in': { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'toast-in': { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        'drawer-in': 'drawer-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 160ms ease-out',
        'toast-in': 'toast-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
