/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hoi: {
          bg: '#121214',
          panel: '#1e1e24',
          card: '#2a2a32',
          border: '#35353f',
          accent: '#f97316', // Naranja HOI4
          accentHover: '#ea580c',
          text: '#f3f4f6',
          muted: '#9ca3af'
        }
      }
    }
  },
  plugins: []
}
