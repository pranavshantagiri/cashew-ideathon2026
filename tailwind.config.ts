import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        line: 'var(--line)',
        brand: 'var(--brand)',
        'brand-soft': 'var(--brand-soft)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        success: 'var(--success)',
        'success-soft': 'var(--success-soft)',
        warn: 'var(--warn)',
        'warn-soft': 'var(--warn-soft)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        unknown: 'var(--unknown)',
        'unknown-soft': 'var(--unknown-soft)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        btn: '10px',
        input: '10px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(30,43,36,.06)',
        md: '0 8px 24px rgba(30,43,36,.08)',
      },
      maxWidth: { content: '1200px' },
      transitionTimingFunction: { out: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        scan: { '0%': { top: '4%' }, '50%': { top: '92%' }, '100%': { top: '4%' } },
        slideIn: { '0%': { opacity: '0', transform: 'translateX(24px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite',
        scan: 'scan 1.8s ease-in-out infinite',
        slideIn: 'slideIn 220ms cubic-bezier(0.16,1,0.3,1) both',
        fadeUp: 'fadeUp 220ms ease-out both',
      },
    },
  },
  plugins: [],
};
export default config;
