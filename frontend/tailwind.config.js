/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bw': {
          'black': '#000000',
          'white': '#ffffff',
          '900': '#111111',
          '800': '#222222',
          '700': '#333333',
          '600': '#444444',
          '500': '#555555',
          '400': '#666666',
          '300': '#888888',
          '200': '#aaaaaa',
          '100': '#cccccc',
          '50': '#eeeeee',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'sm-base': '14px',
        'base': '16px',
      },
      boxShadow: {
        'subtle': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.05)',
        'elevated': '0 8px 24px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}
