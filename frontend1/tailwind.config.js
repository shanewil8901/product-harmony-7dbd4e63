/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0e0e0e',
          soft: '#1c1c1c',
          muted: '#4a4a4a',
        },
        paper: {
          DEFAULT: '#ffffff',
          soft: '#faf8f2',
          warm: '#f4efe1',
        },
        gold: {
          50: '#fdf8e3',
          100: '#fbecb0',
          200: '#f6dc74',
          300: '#f0c94a',
          400: '#e6b325',
          500: '#c9971a',
          600: '#a37714',
          700: '#7a570e',
        },
        brown: {
          50: '#f7f0e6',
          100: '#e9d7bd',
          200: '#d4b28a',
          300: '#b78a5a',
          400: '#8b5a2b',
          500: '#6b4423',
          600: '#4e3018',
          700: '#33200f',
        },
        forest: {
          50: '#eaf3ea',
          100: '#c6e0c4',
          200: '#8fc189',
          300: '#5aa252',
          400: '#3a8034',
          500: '#2a6326',
          600: '#1e4a1c',
          700: '#133012',
        },
        brick: {
          50: '#fbeeea',
          100: '#f3d1c8',
          200: '#e3a496',
          300: '#cf7561',
          400: '#b8503a',
          500: '#9d3b28',
          600: '#7d2c1d',
          700: '#571d13',
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(14,14,14,0.06), 0 8px 24px -12px rgba(107,68,35,0.15)',
      },
    },
  },
  plugins: [],
};
