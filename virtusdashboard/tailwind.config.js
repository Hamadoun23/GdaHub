/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#120d0a',
        surface: '#1a130e',
        surface2: '#241a13',
        border: '#2f2118',
        muted: '#9a8b80',
        accent: '#ff6a2b',
        accent2: '#ff9a3d',
        accentDeep: '#e8481b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
