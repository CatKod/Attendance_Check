/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        apes: {
          red: '#f04030',
          'red-dark': '#d63324',
        },
      },
    },
  },
  plugins: [],
};
