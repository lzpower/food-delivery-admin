/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: { indigo: { 50: '#f0f6ea', 100: '#e3eedb', 600: '#376d42', 700: '#2b603a', 800: '#315b37' }, slate: { 50: '#f8faf5', 100: '#f0f4eb', 200: '#e2e9db', 300: '#d0dbc5', 400: '#99a58f', 500: '#819076', 600: '#637358', 700: '#4d6243', 800: '#354e2d', 900: '#263f22', 950: '#18331f' } },
    },
  },
  plugins: [],
};
