/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"PingFang TC"', '"Noto Sans TC"', '"Microsoft JhengHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        data: { 50: '#eef4ff', 100: '#dbe6fe', 300: '#93b4fd', 500: '#3b6cf6', 600: '#2a55e0', 700: '#1f43b8' },
        parity: { 50: '#fff8eb', 100: '#feeec7', 300: '#fbcb6a', 500: '#e8930c', 600: '#c47308', 700: '#9a560b' },
        overall: { 50: '#f6f1ff', 100: '#ece2ff', 300: '#c6a8fd', 500: '#8b55f0', 600: '#7638dc', 700: '#622ab8' },
      },
    },
  },
  plugins: [],
};
