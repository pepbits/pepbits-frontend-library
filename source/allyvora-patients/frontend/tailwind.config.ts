import type { Config } from 'tailwindcss';

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        sunken: token('sunken'),
        ink: { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        brand: { DEFAULT: token('brand'), strong: token('brand-strong'), soft: token('brand-soft'), ink: token('brand-ink') },
        accent: { DEFAULT: token('accent'), soft: token('accent-soft'), ink: token('accent-ink') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        ok: { DEFAULT: token('ok'), soft: token('ok-soft') },
        rail: { DEFAULT: token('rail'), 2: token('rail-2'), ink: token('rail-ink') },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        cond: ['"IBM Plex Sans Condensed"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        lift: '0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -12px rgb(var(--shadow) / 0.18)',
        pop: '0 12px 40px -12px rgb(var(--shadow) / 0.35), 0 2px 6px rgb(var(--shadow) / 0.08)',
      },
      keyframes: {
        fieldIn: { from: { opacity: '0', transform: 'translateY(-4px)' }, to: { opacity: '1', transform: 'none' } },
        popIn: { from: { opacity: '0', transform: 'scale(.97) translateY(-4px)' }, to: { opacity: '1', transform: 'none' } },
        slideIn: { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        toastIn: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'field-in': 'fieldIn .22s ease-out',
        'pop-in': 'popIn .16s ease-out',
        'slide-in': 'slideIn .22s cubic-bezier(.2,.8,.2,1)',
        'toast-in': 'toastIn .2s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
