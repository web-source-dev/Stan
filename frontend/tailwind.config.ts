import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Refined near-black + paper, kept for backward compatibility.
        ink: '#0b0b12',
        paper: '#ffffff',
        // Premium cool-neutral surface scale.
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f5f5f8',
          subtle: '#fafafb',
          sunken: '#f0f0f4',
        },
        line: '#eaeaf0',
        'line-strong': '#dcdce4',
        // Single strong brand accent — indigo/violet (Linear-esque, trustworthy).
        brand: {
          50: '#eef0ff',
          100: '#e0e3ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#5865f2',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // Semantic accents used across badges / alerts.
        success: {
          50: '#ecfdf3',
          100: '#d1fadf',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
        },
        warn: {
          50: '#fffaeb',
          100: '#fef0c7',
          600: '#b45309',
          700: '#92400e',
        },
        danger: {
          50: '#fef3f2',
          100: '#fee4e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        // Rounded geometric display face for marketing headings (Stan-style).
        display: ['Poppins', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 15 25 / 0.04)',
        soft: '0 1px 2px rgb(15 15 25 / 0.04), 0 4px 12px rgb(15 15 25 / 0.05)',
        card: '0 1px 3px rgb(15 15 25 / 0.04), 0 8px 24px -8px rgb(15 15 25 / 0.08)',
        lift: '0 4px 8px -2px rgb(15 15 25 / 0.06), 0 16px 40px -12px rgb(15 15 25 / 0.16)',
        glow: '0 8px 30px -6px rgb(91 84 232 / 0.45)',
        focus: '0 0 0 4px rgb(91 84 232 / 0.16)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(120deg, #4f46e5 0%, #5865f2 45%, #818cf8 100%)',
        'brand-radial':
          'radial-gradient(900px circle at 50% -10%, rgba(91,84,232,0.16), transparent 60%)',
        // Soft multi-stop aurora used behind the hero / CTA surfaces.
        'aurora':
          'radial-gradient(40% 60% at 20% 20%, rgba(124,125,251,0.20), transparent 60%), radial-gradient(40% 60% at 80% 10%, rgba(91,84,232,0.18), transparent 55%), radial-gradient(50% 70% at 60% 90%, rgba(163,168,255,0.16), transparent 60%)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fade: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // Slow drift for the aurora blobs behind the hero.
        aurora: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(3%, -2%, 0) scale(1.06)' },
          '66%': { transform: 'translate3d(-3%, 2%, 0) scale(0.96)' },
        },
        // Gentle vertical float for layered cards (CSS fallback hero).
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        // Pulsing glow ring for premium accents.
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.95' },
        },
        // Continuous marquee for the social-proof strip.
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        // Rotating conic border for the Pro pricing card.
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        fade: 'fade 0.4s ease both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-up': 'slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        aurora: 'aurora 18s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 9s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
        marquee: 'marquee 32s linear infinite',
        'spin-slow': 'spin-slow 6s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
