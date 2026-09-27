/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Baloo 2', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        cream: {
          DEFAULT: '#fbfbfe',
          soft: '#f4f5fb',
        },
        // "sunset" is now the brand gold/amber accent (CTAs, highlights).
        sunset: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f5b729',
          600: '#d99a1b',
          700: '#b17c14',
          800: '#8a5f0f',
          900: '#6b480c',
        },
        // "lagoon" is now the brand navy (headlines, secondary buttons, nav).
        lagoon: {
          50: '#eef0fb',
          100: '#dbe0f5',
          200: '#b7c0ec',
          300: '#8d9adf',
          400: '#5c6bc9',
          500: '#3a47ab',
          600: '#252f87',
          700: '#1a2168',
          800: '#141a52',
          900: '#10143f',
        },
      },
      boxShadow: {
        soft: '0 8px 30px -8px rgba(20, 26, 82, 0.12)',
        glow: '0 10px 25px -6px rgba(245, 183, 41, 0.5)',
        glowLagoon: '0 10px 25px -6px rgba(26, 33, 104, 0.35)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}
