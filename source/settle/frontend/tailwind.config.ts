import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Onest', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        ink: { DEFAULT: '#0E2A27', 2: '#1B3A36', soft: '#4A615E', mute: '#7B8E8B' },
        pine: { 50: '#EAF4F1', 100: '#D2E8E2', 200: '#A6D0C5', 300: '#6FB2A2', 500: '#1F8A78', 600: '#0F6B5E', 700: '#0B544A', 800: '#0A403A', 900: '#0E2A27' },
        mist: { DEFAULT: '#F2F5F4', 2: '#E8EEEC' },
        line: { DEFAULT: '#DCE4E2', strong: '#C4D1CE' },
        marigold: { 50: '#FFF7E0', 100: '#FDEBB8', 300: '#F5C451', 500: '#E9A100', 700: '#8A5E00', 800: '#6B4800' },
        rose: { 50: '#FCEDF0', 100: '#F7D3DA', 500: '#C8405A', 600: '#AF3249', 700: '#8F2539' },
        indigo: { 50: '#EEF0FC', 100: '#D9DDF7', 500: '#4652C2', 600: '#3A45A8', 700: '#2E3784' },
        sky: { 50: '#E8F2FA', 100: '#CDE3F3', 500: '#2C7DB8', 700: '#1D5884' },
      },
      boxShadow: {
        rail: '0 1px 0 rgba(14,42,39,0.04), 0 8px 24px -12px rgba(14,42,39,0.18)',
        pop: '0 18px 48px -12px rgba(14,42,39,0.35)',
        hair: '0 1px 0 rgba(14,42,39,0.06)',
      },
      borderRadius: { panel: '14px' },
      keyframes: {
        'fill-in': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'pop-in': { from: { opacity: '0', transform: 'translateY(6px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
      },
      animation: {
        'fill-in': 'fill-in .7s cubic-bezier(.2,.8,.2,1) both',
        'pop-in': 'pop-in .18s ease-out both',
        'slide-in': 'slide-in .22s ease-out both',
        pulse2: 'pulse2 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
