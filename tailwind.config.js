/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        'sunny': 'url("/images/weather/sunny.jpg")',
        'rainy': 'url("/images/weather/rainy.jpg")',
        'cloudy': 'url("/images/weather/cloudy.jpg")',
        'snowy': 'url("/images/weather/snowy.jpg")',
        'thunderstorm': 'url("/images/weather/thunderstorm.jpg")',
        'misty': 'url("/images/weather/mist.jpg")',
        'mist': 'url("/images/weather/mist.jpg")',
        'smoke': 'url("/images/weather/mist.jpg")', // Or a specific smoke image
        'haze': 'url("/images/weather/mist.jpg")',   // Or a specific haze image
        'fog': 'url("/images/weather/mist.jpg")', 
        'default': 'url("/images/weather/default.jpg")',
      }
    },
  },
  plugins: [],
};