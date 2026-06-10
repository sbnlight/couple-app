/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主题色:暖粉(与 manifest theme_color 保持一致)
        primary: {
          DEFAULT: '#FB7185', // rose-400
          dark: '#F43F5E', // rose-500,用于按下/激活态
          light: '#FFE4E6', // rose-100,用于浅色背景
        },
        // 全局页面背景
        warmbg: '#FFF8F7',
      },
    },
  },
  plugins: [],
}
