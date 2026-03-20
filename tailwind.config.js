/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        rot: {
          green: '#4ade80',
          dark: '#0a0a0f',
          card: '#111118',
          border: '#1f2937',
          muted: '#6b7280',
        }
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.4s ease forwards',
        'pulse-green': 'pulseGreen 2s infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseGreen: { '0%,100%': { boxShadow: '0 0 0 0 rgba(74,222,128,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(74,222,128,0)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      }
    },
  },
  plugins: [],
}
