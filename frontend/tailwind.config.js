/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#f8fafc', // slate-50
          900: '#f1f5f9', // slate-100
          800: '#e2e8f0', // slate-200
          700: '#cbd5e1', // slate-300
          600: '#94a3b8', // slate-400
          500: '#64748b', // slate-500
        },
        steel: {
          400: '#64748b', // slate-500
          300: '#475569', // slate-600
          200: '#334155', // slate-700
          100: '#1e293b', // slate-800
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
