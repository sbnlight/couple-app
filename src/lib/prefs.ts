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

/* ---------- 外观模式(浅色/深色/跟随系统) ---------- */

export type ThemeMode = 'auto' | 'light' | 'dark'

export const THEME_MODES: { id: ThemeMode; label: string }[] = [
  { id: 'auto', label: '跟随系统' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
]

const MODE_KEY = 'pref-theme-mode'

export function getThemeMode(): ThemeMode {
  const v = localStorage.getItem(MODE_KEY)
  return THEME_MODES.some((m) => m.id === v) ? (v as ThemeMode) : 'auto'
}

export function applyThemeMode(mode: ThemeMode) {
  localStorage.setItem(MODE_KEY, mode)
  const dark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

/* ---------- 聊天气泡样式(自己的气泡,本机生效) ---------- */

export interface BubbleStyle {
  id: string
  label: string
  /** CSS background 值 */
  bg: string
  text: string
}

export const BUBBLE_STYLES: BubbleStyle[] = [
  { id: 'theme', label: '主题渐变', bg: 'linear-gradient(135deg, var(--c-primary), var(--c-primary-dark))', text: '#ffffff' },
  { id: 'peach', label: '蜜桃', bg: 'linear-gradient(135deg, #fda4af, #fb7185)', text: '#ffffff' },
  { id: 'ocean', label: '海洋', bg: 'linear-gradient(135deg, #7dd3fc, #3b82f6)', text: '#ffffff' },
  { id: 'mint', label: '薄荷', bg: 'linear-gradient(135deg, #6ee7b7, #10b981)', text: '#ffffff' },
  { id: 'sunset', label: '日落', bg: 'linear-gradient(135deg, #fdba74, #f472b6)', text: '#ffffff' },
  { id: 'violet', label: '星紫', bg: 'linear-gradient(135deg, #c4b5fd, #8b5cf6)', text: '#ffffff' },
  { id: 'noir', label: '夜金', bg: 'linear-gradient(135deg, #3f3f46, #18181b)', text: '#fcd34d' },
]

const BUBBLE_KEY = 'pref-bubble'

export function getBubbleStyle(): BubbleStyle {
  const v = localStorage.getItem(BUBBLE_KEY)
  return BUBBLE_STYLES.find((b) => b.id === v) ?? BUBBLE_STYLES[0]
}

export function saveBubbleStyle(id: string) {
  localStorage.setItem(BUBBLE_KEY, id)
}

/* ---------- 聊天背景(预设恋爱主题 / 相册自定义,本机生效) ---------- */

// 内嵌 SVG 爱心暗纹
const HEART_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cpath d='M26 36c-7-5.5-11-9.5-11-13.5A5.5 5.5 0 0126 18a5.5 5.5 0 0111 4.5c0 4-4 8-11 13.5z' fill='%23fb7185' fill-opacity='.08'/%3E%3C/svg%3E")`

export interface ChatBgPreset {
  id: string
  label: string
  /** CSS background 值;空串 = 跟随页面默认背景 */
  css: string
}

export const CHAT_BGS: ChatBgPreset[] = [
  { id: 'default', label: '默认', css: '' },
  { id: 'blush', label: '绯雾', css: 'linear-gradient(165deg, #fff1f2 0%, #ffe4e6 45%, #fce7f3 100%)' },
  { id: 'hearts', label: '爱心暗纹', css: `${HEART_PATTERN}, linear-gradient(180deg, #fff8f7, #fff1f2)` },
  { id: 'dusk', label: '黄昏', css: 'linear-gradient(165deg, #fde6e9 0%, #e8d5f5 60%, #d6e0fb 100%)' },
  { id: 'night', label: '星夜', css: 'radial-gradient(circle, rgba(255,255,255,.16) 1px, transparent 1.5px) 0 0 / 26px 26px, linear-gradient(180deg, #2b2150, #1a1432)' },
]

const CHATBG_KEY = 'pref-chat-bg'

/** 背景令牌:'preset:<id>' 或 'custom:<storage路径>' */
export function getChatBgToken(): string {
  return localStorage.getItem(CHATBG_KEY) ?? 'preset:default'
}

export function saveChatBgToken(token: string) {
  localStorage.setItem(CHATBG_KEY, token)
}

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
  applyThemeMode(getThemeMode())
  // 跟随系统时,系统切换深浅色实时生效
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getThemeMode() === 'auto') applyThemeMode('auto')
    })
}
