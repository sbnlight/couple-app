/**
 * 本机偏好设置:字体大小 + 主题色。
 * 存 localStorage,两个人各自手机独立设置,不走服务器同步。
 */

export type FontSize = 'sm' | 'md' | 'lg' | 'xl'

/** 整体界面用 rem 单位,调整根字号即整体缩放 */
export const FONT_SIZES: { id: FontSize; label: string; pct: string }[] = [
  { id: 'sm', label: '小', pct: '87.5%' },
  { id: 'md', label: '标准', pct: '100%' },
  { id: 'lg', label: '大', pct: '112.5%' },
  { id: 'xl', label: '特大', pct: '125%' },
]

export type ThemeId = 'rose' | 'blue' | 'green' | 'purple'

/** 预设主题;具体色值在 index.css 的 CSS 变量里定义 */
export const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: 'rose', label: '蜜桃粉', swatch: '#FB7185' },
  { id: 'blue', label: '雾霾蓝', swatch: '#60A5FA' },
  { id: 'green', label: '抹茶绿', swatch: '#34D399' },
  { id: 'purple', label: '香芋紫', swatch: '#A78BFA' },
]

const FONT_KEY = 'pref-font-size'
const THEME_KEY = 'pref-theme'

export function getFontSize(): FontSize {
  const v = localStorage.getItem(FONT_KEY)
  return FONT_SIZES.some((f) => f.id === v) ? (v as FontSize) : 'md'
}

export function applyFontSize(id: FontSize) {
  const item = FONT_SIZES.find((f) => f.id === id) ?? FONT_SIZES[1]
  document.documentElement.style.fontSize = item.pct
  localStorage.setItem(FONT_KEY, item.id)
}

export function getTheme(): ThemeId {
  const v = localStorage.getItem(THEME_KEY)
  return THEMES.some((t) => t.id === v) ? (v as ThemeId) : 'rose'
}

export function applyTheme(id: ThemeId) {
  // 默认粉色直接走 :root 变量,其他主题通过 data-theme 覆盖
  if (id === 'rose') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', id)
  localStorage.setItem(THEME_KEY, id)
}

/** 应用启动时恢复上次的偏好(在 main.tsx 渲染前调用) */
export function initPrefs() {
  applyFontSize(getFontSize())
  applyTheme(getTheme())
}
