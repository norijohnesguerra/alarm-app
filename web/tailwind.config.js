/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          bg: '#0a0a0f',
          surface: '#12121a',
          border: '#1e1e2e',
          cyan: '#00e5ff',
          magenta: '#ff00ff',
          lime: '#76ff03',
          orange: '#ff9100',
          pink: '#ff4081',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 15px rgba(0, 229, 255, 0.4), 0 0 30px rgba(0, 229, 255, 0.1)',
        'neon-magenta': '0 0 15px rgba(255, 0, 255, 0.4), 0 0 30px rgba(255, 0, 255, 0.1)',
        'neon-lime': '0 0 15px rgba(118, 255, 3, 0.4), 0 0 30px rgba(118, 255, 3, 0.1)',
        'neon-orange': '0 0 15px rgba(255, 145, 0, 0.4), 0 0 30px rgba(255, 145, 0, 0.1)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
