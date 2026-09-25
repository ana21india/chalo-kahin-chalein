/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'serif'],
      },
      colors: {
        cream: {
          DEFAULT: '#fdf6ec',
          soft: '#fbf1e3',
        },
        sunset: {
          50: '#fff6ed',
          100: '#ffe9d3',
          200: '#ffcfa6',
          300: '#ffab6e',
          400: '#ff7d34',
          500: '#fd5a0e',
          600: '#ee4004',
          700: '#c52d06',
          800: '#9c250c',
          900: '#7e210d',
        },
        lagoon: {
          50: '#eefcfa',
          100: '#d4f6f1',
          200: '#aeece4',
          300: '#78dcd1',
          400: '#41c2b6',
          500: '#26a69b',
          600: '#1c837c',
          700: '#1b6864',
          800: '#1b5451',
          900: '#194645',
        },
      },
      boxShadow: {
        soft: '0 8px 30px -8px rgba(23, 23, 23, 0.15)',
        glow: '0 10px 25px -6px rgba(253, 90, 14, 0.45)',
        glowLagoon: '0 10px 25px -6px rgba(38, 166, 155, 0.4)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
