/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#15231e',
        forest: '#1d4938',
        leaf: '#a7d76a',
        paper: '#f5f6f3',
        line: '#e7eae5',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 50px rgba(23, 43, 33, .08)',
      },
    },
  },
  plugins: [],
}
