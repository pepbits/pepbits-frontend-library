import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1440px', '3xl': '1680px' },
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        cond: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#0F2E35', 900: '#0B242A', 800: '#143841', 700: '#1D4851', 600: '#2B5D67', 400: '#6E9198', 300: '#97B6BB', 200: '#C5D8DA', 100: '#E1ECEC' },
        canvas: '#F2F5F4',
        line: '#DCE4E3',
        muted: '#5A6D70',
        text: '#122A2F',
        teal: { 50: '#E7F3F0', 100: '#CFE8E2', 200: '#A3D3C8', 500: '#2A8E7F', 600: '#1F7A6D', 700: '#17645A', 800: '#114E46' },
        marigold: { 50: '#FDF4E3', 100: '#FAE6C0', 400: '#EDB459', 500: '#E8A33D', 600: '#C9852A', 700: '#9C6418' },
        crimson: { 50: '#FBEBED', 100: '#F5CED3', 500: '#D04A58', 600: '#B83A48', 700: '#93303B' },
        kind: { person: '#3D7BD9', machine: '#8A5CD6', room: '#1F9E89', chair: '#D9822B', bed: '#C2508A', vehicle: '#5F6B7A' },
      },
      boxShadow: {
        lift: '0 1px 2px rgba(15,46,53,0.06), 0 6px 18px -8px rgba(15,46,53,0.18)',
        pop: '0 12px 40px -12px rgba(11,36,42,0.35)',
        inset: 'inset 0 0 0 1px rgba(15,46,53,0.08)',
      },
      borderRadius: { xl: '0.85rem' },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(110%)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        'drawer-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise': { from: { transform: 'translateY(6px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'drain': { from: { transform: 'scaleX(1)' }, to: { transform: 'scaleX(0)' } },
        'ring': { '0%,100%': { transform: 'rotate(0)' }, '20%': { transform: 'rotate(14deg)' }, '40%': { transform: 'rotate(-12deg)' }, '60%': { transform: 'rotate(8deg)' }, '80%': { transform: 'rotate(-4deg)' } },
        'pulse-dot': { '0%': { boxShadow: '0 0 0 0 rgba(232,163,61,0.6)' }, '100%': { boxShadow: '0 0 0 8px rgba(232,163,61,0)' } },
      },
      animation: {
        'slide-in': 'slide-in 280ms cubic-bezier(.2,.9,.3,1.2)',
        'drawer-in': 'drawer-in 220ms cubic-bezier(.2,.8,.2,1)',
        'fade-in': 'fade-in 160ms ease-out',
        rise: 'rise 200ms ease-out',
        drain: 'drain linear forwards',
        ring: 'ring 700ms ease-in-out',
        'pulse-dot': 'pulse-dot 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
