/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主题色走 CSS 变量,具体色值与各主题在 src/index.css 中定义,
        // 用户可在「我们」页切换主题(默认蜜桃粉)
        primary: {
          DEFAULT: 'var(--c-primary)', // 主色:按钮、强调
          dark: 'var(--c-primary-dark)', // 深一档:文字、按下态
          light: 'var(--c-primary-light)', // 浅一档:头像占位等浅色块
        },
        warmbg: 'var(--c-bg)', // 全局页面背景
        line: 'var(--c-line)', // 分隔线/边框
        soft: 'var(--c-soft)', // 列表按下态等极浅背景
      },
    },
  },
  plugins: [],
}
