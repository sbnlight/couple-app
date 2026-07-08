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

/* ---------- 聊天消息间距(本机偏好) ---------- */
export type MsgGap = 'sm' | 'md' | 'lg'

/** 每档给出:同组相邻消息的间距 + 不同组之间的间距(Tailwind mb-* 类) */
export const MSG_GAPS: { id: MsgGap; label: string; grouped: string; group: string }[] = [
  // 中档用「适中」而非「标准」:后者与字号档 FONT_SIZES 的「标准」是同一 i18n 源字符串键,
  // 会被误翻成字号缩写「M/標準」。三档标签的英/日译文见 i18n.ts。
  { id: 'sm', label: '紧凑', grouped: 'mb-0.5', group: 'mb-3' },
  { id: 'md', label: '适中', grouped: 'mb-1.5', group: 'mb-4' },
  { id: 'lg', label: '宽松', grouped: 'mb-2.5', group: 'mb-6' },
]

const MSG_GAP_KEY = 'pref-msg-gap'

export function getMsgGap(): MsgGap {
  const v = localStorage.getItem(MSG_GAP_KEY)
  return MSG_GAPS.some((g) => g.id === v) ? (v as MsgGap) : 'md'
}

export function saveMsgGap(id: MsgGap) {
  localStorage.setItem(MSG_GAP_KEY, id)
}

/** 取当前间距档对应的两个 mb 类 */
export function msgGapClasses(id: MsgGap): { grouped: string; group: string } {
  const g = MSG_GAPS.find((x) => x.id === id) ?? MSG_GAPS[1]
  return { grouped: g.grouped, group: g.group }
}

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

// 「自动更新我的位置」开关(本机偏好,各自的手机独立决定要不要自动分享位置)
const AUTO_LOC_KEY = 'pref-auto-location'
export function getAutoLocation(): boolean {
  return localStorage.getItem(AUTO_LOC_KEY) === '1'
}
export function setAutoLocation(on: boolean) {
  localStorage.setItem(AUTO_LOC_KEY, on ? '1' : '0')
}

const MODE_KEY = 'pref-theme-mode'

export function getThemeMode(): ThemeMode {
  const v = localStorage.getItem(MODE_KEY)
  return THEME_MODES.some((m) => m.id === v) ? (v as ThemeMode) : 'auto'
}

/** 同步 PWA 状态栏配色(<meta name="theme-color">)到当前主题/深浅色,避免恒为初始蜜桃粉 */
function syncThemeColor() {
  try {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) return
    // 用当前主题的页面背景色(深色是 #161118,浅色是各主题暖白),让状态栏与页面融为一体
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim()
    if (bg) meta.setAttribute('content', bg)
  } catch {
    // 状态栏配色非关键,读取失败保持原值
  }
}

/**
 * 手动切换主题/深浅色时,给 <html> 临时挂一个 .theme-anim 类,
 * 让承载主题色的元素在 ~260ms 窗口内对 background/border/color 做一次柔和过渡;
 * 窗口结束移除,避免常驻过渡影响 hover 等日常交互。
 * 冷启动 initPrefs 不调用它 —— 所以首屏恢复偏好不会闪。
 */
let themeAnimTimer: number | undefined
function flashThemeTransition() {
  // 尊重「减少动态效果」:直接不加过渡窗口(CSS 那边也有兜底,双保险)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const el = document.documentElement
  el.classList.add('theme-anim')
  if (themeAnimTimer) window.clearTimeout(themeAnimTimer)
  themeAnimTimer = window.setTimeout(() => {
    el.classList.remove('theme-anim')
    themeAnimTimer = undefined
  }, 260)
}

export function applyThemeMode(mode: ThemeMode, animate = false) {
  if (animate) flashThemeTransition()
  localStorage.setItem(MODE_KEY, mode)
  const dark =
    mode === 'dark' ||
    (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  syncThemeColor()
}

/* ---------- 聊天气泡样式(自己的气泡,本机生效) ---------- */

/** 气泡角落挂件(emoji 探头装饰,QQ 风) */
export interface BubbleDeco {
  emoji: string
  pos: 'tl' | 'tr' | 'bl' | 'br'
  size?: number
  rot?: number
  /** 挂件持续动画(让气泡「活」起来):见 index.css 的 deco-* */
  anim?: 'float' | 'twinkle' | 'swing' | 'wag' | 'bob' | 'spin' | 'pop' | 'rise'
}

export interface BubbleStyle {
  id: string
  label: string
  /** CSS 背景值(渐变或纯色,可多层) */
  bg: string
  text: string
  /** 分组 */
  group: string
  /** 动态效果的 CSS 类(见 index.css) */
  anim?: string
  /** 可选描边 */
  border?: string
  /** 异形圆角(覆盖默认) */
  radius?: string
  /** 立体/特效阴影 */
  shadow?: string
  /** 文字阴影(霓虹字等) */
  textShadow?: string
  /** 额外效果类(玻璃拟态/手绘/像素/故障等) */
  extraClass?: string
  /** 角落挂件(emoji) */
  deco?: BubbleDeco[]
  /** 气泡小尾巴尖(对话气泡感) */
  tail?: boolean
  /** SVG 手绘顶饰:气泡「长出」耳朵/角/皇冠等(非 emoji) */
  topper?:
    | 'cat'
    | 'bear'
    | 'bunny'
    | 'fox'
    | 'panda'
    | 'devil'
    | 'crown'
    | 'antenna'
    | 'sprout'
    | 'halo'
    | 'wings'
  /** 顶饰/尾巴的颜色;不填则用气泡主色 */
  accent?: string
  /** 角落原创吉祥物贴纸(内联 SVG,见 MessageBubble 的 MASCOTS 注册表);QQ「探头」既视感 */
  mascot?: string
  /** 吉祥物所在角(默认右下 br) */
  mascotPos?: 'tl' | 'tr' | 'bl' | 'br'
}

export const BUBBLE_STYLES: BubbleStyle[] = [
  // ==== M2 新增(QQ 风):原创吉祥物探头 + 画框级边框 ====
  // ---- 萌宠伙伴:原创卡通角色从角落探头(轻轻摇摆),浅底深字保证可读 ----
  { group: '萌宠伙伴', id: 'pal-penguin', label: '企鹅小Q', bg: 'linear-gradient(135deg, #e0f2fe, #f0f9ff)', text: '#075985', radius: '20px', border: '1.5px solid #bae6fd', mascot: 'penguin' },
  { group: '萌宠伙伴', id: 'pal-bear', label: '抱抱熊', bg: 'linear-gradient(135deg, #fef3c7, #fffbeb)', text: '#92400e', radius: '20px', border: '1.5px solid #fde68a', mascot: 'bear' },
  { group: '萌宠伙伴', id: 'pal-bunny', label: '邦尼兔', bg: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', text: '#9d174d', radius: '20px', border: '1.5px solid #fbcfe8', mascot: 'bunny' },
  { group: '萌宠伙伴', id: 'pal-cat', label: '橘猫喵', bg: 'linear-gradient(135deg, #fff7ed, #ffedd5)', text: '#9a3412', radius: '20px', border: '1.5px solid #fed7aa', mascot: 'cat' },
  { group: '萌宠伙伴', id: 'pal-shiba', label: '柴犬君', bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)', text: '#854d0e', radius: '20px', border: '1.5px solid #fde68a', mascot: 'shiba' },
  { group: '萌宠伙伴', id: 'pal-chick', label: '小鸡黄黄', bg: 'linear-gradient(135deg, #fefce8, #fef9c3)', text: '#854d0e', radius: '20px', border: '1.5px solid #fef08a', mascot: 'chick' },
  { group: '萌宠伙伴', id: 'pal-panda', label: '团子熊猫', bg: 'linear-gradient(135deg, #f8fafc, #ffffff)', text: '#334155', radius: '20px', border: '1.5px solid #e2e8f0', mascot: 'panda' },
  { group: '萌宠伙伴', id: 'pal-frog', label: '呱呱蛙', bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', text: '#166534', radius: '20px', border: '1.5px solid #bbf7d0', mascot: 'frog' },
  { group: '萌宠伙伴', id: 'pal-dino', label: '小恐龙', bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', text: '#065f46', radius: '20px', border: '1.5px solid #a7f3d0', mascot: 'dino' },
  { group: '萌宠伙伴', id: 'pal-ghost', label: '幽灵啵', bg: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', text: '#5b21b6', radius: '20px', border: '1.5px solid #ddd6fe', mascot: 'ghost' },
  { group: '萌宠伙伴', id: 'pal-duck', label: '鸭鸭嘎', bg: 'linear-gradient(135deg, #fefce8, #fffbeb)', text: '#a16207', radius: '20px', border: '1.5px solid #fde68a', mascot: 'duck' },
  { group: '萌宠伙伴', id: 'pal-piglet', label: '猪猪乖', bg: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', text: '#9d174d', radius: '20px', border: '1.5px solid #fbcfe8', mascot: 'piglet' },
  { group: '萌宠伙伴', id: 'pal-cat-tr', label: '橘猫探头', bg: 'linear-gradient(135deg, #fff7ed, #ffedd5)', text: '#9a3412', radius: '20px', border: '1.5px solid #fed7aa', mascot: 'cat', mascotPos: 'tr' },
  { group: '萌宠伙伴', id: 'pal-bunny-tl', label: '兔兔冒头', bg: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', text: '#9d174d', radius: '20px', border: '1.5px solid #fbcfe8', mascot: 'bunny', mascotPos: 'tl' },
  // ---- 渐变画框:一圈渐变彩边(尊重圆角,mask 挖空法) ----
  { group: '渐变画框', id: 'gf-rose', label: '玫瑰画框', bg: '#fff5f6', text: '#9f1239', radius: '18px', extraClass: 'bubble-gframe-rose' },
  { group: '渐变画框', id: 'gf-gold', label: '鎏金画框', bg: '#fffdf5', text: '#78350f', radius: '18px', extraClass: 'bubble-gframe-gold' },
  { group: '渐变画框', id: 'gf-mint', label: '薄荷画框', bg: '#f2fdfa', text: '#065f46', radius: '18px', extraClass: 'bubble-gframe-mint' },
  { group: '渐变画框', id: 'gf-violet', label: '香芋画框', bg: '#faf7ff', text: '#6d28d9', radius: '18px', extraClass: 'bubble-gframe-violet' },
  { group: '渐变画框', id: 'gf-aurora', label: '极光画框', bg: '#f6fbff', text: '#0f766e', radius: '18px', extraClass: 'bubble-gframe-aurora' },
  { group: '渐变画框', id: 'gf-rose-cat', label: '玫瑰猫框', bg: '#fff5f6', text: '#9f1239', radius: '18px', extraClass: 'bubble-gframe-rose', mascot: 'cat' },
  { group: '渐变画框', id: 'gf-mint-frog', label: '薄荷蛙框', bg: '#f2fdfa', text: '#065f46', radius: '18px', extraClass: 'bubble-gframe-mint', mascot: 'frog' },
  { group: '渐变画框', id: 'gf-violet-ghost', label: '香芋幽灵', bg: '#faf7ff', text: '#6d28d9', radius: '18px', extraClass: 'bubble-gframe-violet', mascot: 'ghost' },
  // ---- 甜心花框:点点花边 / 奶油扇贝 ----
  { group: '甜心花框', id: 'ff-berry', label: '莓果花框', bg: '#fff5fa', text: '#be185d', radius: '16px', extraClass: 'bubble-frame-berry', deco: [{ emoji: '🍓', pos: 'tr', size: 14, anim: 'bob' }] },
  { group: '甜心花框', id: 'ff-sky', label: '晴空花框', bg: '#f0f9ff', text: '#0369a1', radius: '16px', extraClass: 'bubble-frame-sky', deco: [{ emoji: '☁️', pos: 'tl', size: 14, anim: 'float' }] },
  { group: '甜心花框', id: 'ff-scallop', label: '奶油扇贝', bg: '#fff5fa', text: '#9d174d', radius: '14px', extraClass: 'bubble-frame-scallop', deco: [{ emoji: '🍦', pos: 'tr', size: 14 }] },
  { group: '甜心花框', id: 'ff-scallop-bunny', label: '扇贝兔兔', bg: '#fff5fa', text: '#9d174d', radius: '14px', extraClass: 'bubble-frame-scallop', mascot: 'bunny' },
  { group: '甜心花框', id: 'ff-berry-piglet', label: '莓果猪猪', bg: '#fff5fa', text: '#be185d', radius: '16px', extraClass: 'bubble-frame-berry', mascot: 'piglet' },
  { group: '甜心花框', id: 'ff-sky-penguin', label: '晴空企鹅', bg: '#f0f9ff', text: '#075985', radius: '16px', extraClass: 'bubble-frame-sky', mascot: 'penguin' },
  // ---- 派对时刻:彩纸飘落 / 暖光光斑 ----
  { group: '派对时刻', id: 'party-confetti', label: '彩纸飞扬', bg: 'linear-gradient(135deg, #a855f7, #6366f1)', text: '#ffffff', radius: '18px', extraClass: 'bubble-confetti', deco: [{ emoji: '🎉', pos: 'tr', size: 16, anim: 'pop' }] },
  { group: '派对时刻', id: 'party-birthday', label: '生日快乐', bg: 'linear-gradient(135deg, #f0abfc, #d946ef)', text: '#ffffff', radius: '18px', extraClass: 'bubble-confetti', deco: [{ emoji: '🎂', pos: 'tr', size: 17, anim: 'bob' }], mascot: 'chick' },
  { group: '派对时刻', id: 'party-bokeh', label: '暖光派对', bg: 'linear-gradient(135deg, #fb923c, #ec4899)', text: '#ffffff', radius: '20px', extraClass: 'bubble-bokeh' },
  { group: '派对时刻', id: 'party-cheer', label: '举杯庆祝', bg: 'linear-gradient(135deg, #f59e0b, #ef4444)', text: '#fff7ed', radius: '18px', extraClass: 'bubble-confetti', deco: [{ emoji: '🥂', pos: 'tr', size: 16, anim: 'swing' }] },
  { group: '派对时刻', id: 'party-star-bear', label: '星光小熊', bg: 'linear-gradient(135deg, #312e81, #4c1d95)', text: '#e0e7ff', radius: '18px', extraClass: 'bubble-stars', mascot: 'bear' },
  // ---- 萌宠画框:吉祥物 + 花框/特效 双层可爱 ----
  { group: '萌宠画框', id: 'pf-penguin', label: '冰蓝企鹅框', bg: '#f0f9ff', text: '#075985', radius: '18px', extraClass: 'bubble-frame-sky', mascot: 'penguin' },
  { group: '萌宠画框', id: 'pf-panda', label: '竹语熊猫框', bg: '#f0fdf4', text: '#166534', radius: '18px', extraClass: 'bubble-frame-flowers', mascot: 'panda' },
  { group: '萌宠画框', id: 'pf-duck', label: '暖阳鸭鸭框', bg: '#fffbeb', text: '#a16207', radius: '18px', extraClass: 'bubble-gframe-gold', mascot: 'duck' },
  { group: '萌宠画框', id: 'pf-shiba', label: '柴犬金框', bg: '#fffdf5', text: '#854d0e', radius: '18px', extraClass: 'bubble-gframe-gold', mascot: 'shiba' },
  { group: '萌宠画框', id: 'pf-dino', label: '恐龙萤火', bg: 'linear-gradient(160deg, #14532d, #052e16)', text: '#d9f99d', radius: '18px', extraClass: 'bubble-firefly', mascot: 'dino' },
  { group: '萌宠画框', id: 'pf-frog-lace', label: '蕾丝呱呱', bg: '#ffffff', text: '#166534', radius: '18px', extraClass: 'bubble-frame-lace', mascot: 'frog' },
  // ---- 萌宠场景:吉祥物 + 动态氛围(下雪/樱吹/星夜/汽泡…) ----
  { group: '萌宠场景', id: 'ps-penguin-snow', label: '企鹅踏雪', bg: 'linear-gradient(160deg, #7c6f9f, #3b3a5c)', text: '#f1f5f9', radius: '18px', extraClass: 'bubble-snowfall', mascot: 'penguin' },
  { group: '萌宠场景', id: 'ps-bear-snow', label: '小熊初雪', bg: 'linear-gradient(160deg, #cbd5e1, #94a3b8)', text: '#1e293b', radius: '18px', extraClass: 'bubble-snowfall', mascot: 'bear' },
  { group: '萌宠场景', id: 'ps-bunny-sakura', label: '兔兔樱吹雪', bg: 'linear-gradient(160deg, #fdf2f8, #fce7f3)', text: '#9d174d', radius: '20px', border: '1px solid #fbcfe8', extraClass: 'bubble-sakura', mascot: 'bunny' },
  { group: '萌宠场景', id: 'ps-cat-sakura', label: '猫咪赏樱', bg: 'linear-gradient(160deg, #fff1f2, #ffe4e6)', text: '#9f1239', radius: '20px', border: '1px solid #fecdd3', extraClass: 'bubble-sakura', mascot: 'cat' },
  { group: '萌宠场景', id: 'ps-panda-stars', label: '熊猫望星', bg: 'linear-gradient(135deg, #1e1b4b, #0f172a)', text: '#e0e7ff', radius: '18px', extraClass: 'bubble-stars', mascot: 'panda' },
  { group: '萌宠场景', id: 'ps-ghost-stars', label: '幽灵夜游', bg: 'linear-gradient(135deg, #312e81, #1e1b4b)', text: '#ede9fe', radius: '18px', extraClass: 'bubble-stars', mascot: 'ghost' },
  { group: '萌宠场景', id: 'ps-duck-soda', label: '鸭鸭汽水', bg: 'linear-gradient(180deg, #67e8f9, #0ea5e9)', text: '#f0fdff', radius: '20px', extraClass: 'bubble-soda', mascot: 'duck' },
  { group: '萌宠场景', id: 'ps-frog-soda', label: '蛙蛙冒泡', bg: 'linear-gradient(180deg, #6ee7b7, #10b981)', text: '#f0fdf4', radius: '20px', extraClass: 'bubble-soda', mascot: 'frog' },
  { group: '萌宠场景', id: 'ps-shiba-shimmer', label: '柴犬流光', bg: 'linear-gradient(135deg, #fcd34d, #f59e0b)', text: '#78350f', radius: '18px', extraClass: 'bubble-shimmer', mascot: 'shiba' },
  { group: '萌宠场景', id: 'ps-piglet-ripple', label: '猪猪湖心', bg: 'linear-gradient(135deg, #f9a8d4, #ec4899)', text: '#fff0f6', radius: '20px', extraClass: 'bubble-ripple', mascot: 'piglet' },
  { group: '萌宠场景', id: 'ps-dino-wave', label: '恐龙冲浪', bg: 'linear-gradient(180deg, #38bdf8, #0284c7)', text: '#f0f9ff', radius: '18px', extraClass: 'bubble-wave', mascot: 'dino' },
  { group: '萌宠场景', id: 'ps-chick-firefly', label: '小鸡萤夏', bg: 'linear-gradient(160deg, #14532d, #052e16)', text: '#d9f99d', radius: '18px', extraClass: 'bubble-firefly', mascot: 'chick' },
  // ---- 臻品:高级光效 + 羽翼(每款精修) ----
  { group: '臻品', id: 'lux-ring', label: '流光彩环', bg: 'linear-gradient(135deg, #2e1065, #1e1b4b)', text: '#ede9fe', radius: '18px', extraClass: 'bubble-ring' },
  { group: '臻品', id: 'lux-aura', label: '梦境光晕', bg: 'linear-gradient(135deg, #ffffff, #fdf2f8)', text: '#9d174d', radius: '20px', extraClass: 'bubble-aura' },
  { group: '臻品', id: 'lux-neon-cyan', label: '冰蓝霓虹', bg: 'linear-gradient(135deg, #0e7490, #155e75)', text: '#cffafe', radius: '16px', border: '1.5px solid #67e8f9', extraClass: 'bubble-neon-cyan-x' },
  { group: '臻品', id: 'lux-neon-pink', label: '热恋霓虹', bg: 'linear-gradient(135deg, #9d174d, #831843)', text: '#fce7f3', radius: '16px', border: '1.5px solid #f9a8d4', extraClass: 'bubble-neon-pink-x' },
  { group: '臻品', id: 'lux-angel', label: '天使之翼', bg: 'linear-gradient(135deg, #eff6ff, #ede9fe)', text: '#4338ca', accent: '#fef3c7', topper: 'wings', tail: true, radius: '20px', shadow: '0 4px 18px -6px rgba(167,139,250,0.7)' },
  { group: '臻品', id: 'lux-darkwing', label: '暗夜之翼', bg: 'linear-gradient(135deg, #450a0a, #18181b)', text: '#fecaca', accent: '#b91c1c', topper: 'wings', tail: true, radius: '16px', shadow: '0 4px 18px -6px rgba(220,38,38,0.7)' },
  { group: '臻品', id: 'lux-frost', label: '霜蓝之翼', bg: 'linear-gradient(135deg, #1e3a8a, #1e293b)', text: '#dbeafe', accent: '#93c5fd', topper: 'wings', tail: true, radius: '16px', shadow: '0 4px 18px -6px rgba(96,165,250,0.7)' },
  { group: '臻品', id: 'lux-gold', label: '鎏金描边', bg: 'linear-gradient(135deg, #292524, #1c1917)', text: '#fde68a', radius: '14px', border: '2px solid #d4af37', shadow: '0 0 14px -2px rgba(212,175,55,0.6), inset 0 0 8px rgba(212,175,55,0.25)' },
  // ---- 画框臻品:QQ 风双层画框(彩色外框 + 浅色内芯),圈层用多重 box-shadow 实现 ----
  { group: '画框臻品', id: 'frame-doraemon', label: '童趣蓝框', bg: '#ffffff', text: '#1d4ed8', radius: '16px', shadow: '0 0 0 4px #93c5fd, 0 0 0 6px #fde047', deco: [{ emoji: '⭐', pos: 'tr', size: 14, anim: 'twinkle' }, { emoji: '🔔', pos: 'bl', size: 13, anim: 'swing' }] },
  { group: '画框臻品', id: 'frame-strawberry', label: '草莓酱吐司', bg: '#fffbeb', text: '#b91c1c', radius: '16px', shadow: '0 0 0 4px #fecaca, 0 0 0 6px #ef4444', deco: [{ emoji: '🍓', pos: 'tr', size: 15, anim: 'bob' }] },
  { group: '画框臻品', id: 'frame-mint', label: '薄荷奶盖', bg: '#ffffff', text: '#047857', radius: '18px', shadow: '0 0 0 4px #a7f3d0, 0 0 0 6px #10b981', deco: [{ emoji: '🌿', pos: 'bl', size: 14, rot: -20 }] },
  { group: '画框臻品', id: 'frame-orange', label: '蜜柑苏打', bg: '#fff7ed', text: '#c2410c', radius: '18px', shadow: '0 0 0 4px #fed7aa, 0 0 0 6px #fb923c', deco: [{ emoji: '🍊', pos: 'tr', size: 15, anim: 'bob' }] },
  { group: '画框臻品', id: 'frame-taro', label: '紫芋泡芙', bg: '#faf5ff', text: '#7e22ce', radius: '18px', shadow: '0 0 0 4px #e9d5ff, 0 0 0 6px #a855f7', deco: [{ emoji: '🍇', pos: 'br', size: 14 }] },
  { group: '画框臻品', id: 'frame-sky', label: '天空之城', bg: '#f0f9ff', text: '#0369a1', radius: '20px', shadow: '0 0 0 4px #bae6fd, 0 0 0 6px #38bdf8', deco: [{ emoji: '☁️', pos: 'tl', size: 15, anim: 'float' }, { emoji: '🛩', pos: 'br', size: 13 }] },
  { group: '画框臻品', id: 'frame-blackgold', label: '黑金请柬', bg: '#1c1917', text: '#fde68a', radius: '14px', shadow: '0 0 0 1.5px #d4af37, 0 0 0 5px #1c1917, 0 0 0 6.5px #d4af37' },
  { group: '画框臻品', id: 'frame-patch', label: '缝线布贴', bg: '#fef3c7', text: '#92400e', radius: '12px', border: '2px solid #d97706', extraClass: 'bubble-stitch', deco: [{ emoji: '🧸', pos: 'br', size: 16, rot: 10 }] },
  { group: '画框臻品', id: 'frame-ticket', label: '车票票根', bg: '#fffbeb', text: '#78350f', radius: '4px', border: '1.5px solid #d6d3d1', extraClass: 'bubble-stitch', deco: [{ emoji: '🎫', pos: 'tr', size: 14, rot: 15 }] },
  { group: '画框臻品', id: 'frame-polaroid', label: '拍立得', bg: '#ffffff', text: '#44403c', radius: '3px', shadow: '0 0 0 5px #ffffff, 0 0 0 6px #e7e5e4, 0 8px 16px -8px rgba(0,0,0,0.35)', deco: [{ emoji: '📷', pos: 'tr', size: 14 }] },
  // ---- 花边画框:图案花边围绕气泡一圈 ----
  { group: '花边画框', id: 'lace-garden', label: '碎花园圃', bg: '#ffffff', text: '#9d174d', radius: '16px', extraClass: 'bubble-frame-flowers' },
  { group: '花边画框', id: 'lace-goldstar', label: '星夜金框', bg: '#1c1917', text: '#fde68a', radius: '16px', extraClass: 'bubble-frame-gold' },
  { group: '花边画框', id: 'lace-lace', label: '蕾丝少女', bg: '#ffffff', text: '#be185d', radius: '18px', extraClass: 'bubble-frame-lace' },
  { group: '花边画框', id: 'lace-love', label: 'LOVE 布签', bg: '#fff7ed', text: '#c2410c', radius: '14px', border: '1.5px solid #fed7aa', extraClass: 'bubble-tag-love' },
  { group: '花边画框', id: 'lace-honey', label: 'HONEY 布签', bg: '#f5f3ff', text: '#6d28d9', radius: '14px', border: '1.5px solid #ddd6fe', extraClass: 'bubble-tag-honey', deco: [{ emoji: '🐝', pos: 'br', size: 13, anim: 'float' }] },
  { group: '花边画框', id: 'lace-meow', label: 'MEOW 布签', bg: '#fefce8', text: '#a16207', radius: '14px', border: '1.5px solid #fde68a', extraClass: 'bubble-tag-meow', deco: [{ emoji: '🐱', pos: 'br', size: 15, anim: 'bob' }] },
  // ---- 小剧场:气泡即一个小场景(QQ 场景秀) ----
  { group: '小剧场', id: 'scene-winter', label: '冬日情怀', bg: 'linear-gradient(180deg, #1e3a6e 0 68%, #f1f5f9 68%)', text: '#f8fafc', textShadow: '0 1px 2px rgba(30,58,110,0.8)', radius: '14px', extraClass: 'bubble-snowfall', deco: [{ emoji: '⛄', pos: 'br', size: 20 }, { emoji: '🌙', pos: 'tl', size: 13 }] },
  { group: '小剧场', id: 'scene-lantern', label: '天灯祈愿', bg: 'linear-gradient(180deg, #312e81, #6d28d9)', text: '#fef3c7', radius: '16px', extraClass: 'bubble-lanterns', deco: [{ emoji: '🏮', pos: 'tr', size: 15, anim: 'rise' }] },
  { group: '小剧场', id: 'scene-soccer', label: '绿茵球场', bg: 'repeating-linear-gradient(90deg, #16a34a 0 16px, #15803d 16px 32px)', text: '#ffffff', radius: '14px', border: '2px solid #ffffff', deco: [{ emoji: '⚽', pos: 'br', size: 16, anim: 'wag' }] },
  { group: '小剧场', id: 'scene-schoolbus', label: '疯狂校车', bg: 'linear-gradient(180deg, #bae6fd 0 55%, #fbbf24 55%)', text: '#1e3a8a', radius: '12px', deco: [{ emoji: '🚌', pos: 'bl', size: 18 }, { emoji: '☀️', pos: 'tr', size: 13, anim: 'twinkle' }] },
  { group: '小剧场', id: 'scene-melon', label: '夏日西瓜', bg: '#f87171', text: '#ffffff', radius: '20px', shadow: '0 0 0 3px #fecaca, 0 0 0 7px #16a34a', deco: [{ emoji: '🍉', pos: 'tr', size: 15 }] },
  { group: '小剧场', id: 'scene-izakaya', label: '深夜食堂', bg: 'linear-gradient(135deg, #431407, #292524)', text: '#fdba74', radius: '12px', extraClass: 'bubble-candle', deco: [{ emoji: '🍜', pos: 'tr', size: 16, anim: 'bob' }, { emoji: '🏮', pos: 'bl', size: 12, anim: 'swing' }] },
  { group: '小剧场', id: 'scene-camp', label: '露营篝火', bg: 'linear-gradient(180deg, #052e16, #14532d)', text: '#fef9c3', radius: '14px', extraClass: 'bubble-candle', deco: [{ emoji: '🔥', pos: 'bl', size: 15, anim: 'twinkle' }, { emoji: '⛺', pos: 'tr', size: 15 }] },
  { group: '小剧场', id: 'scene-funfair', label: '梦幻乐园', bg: 'linear-gradient(135deg, #f0abfc, #818cf8)', text: '#ffffff', radius: '20px', deco: [{ emoji: '🎡', pos: 'tr', size: 17, anim: 'spin' }, { emoji: '🎠', pos: 'bl', size: 14 }] },
  // ---- 文字韵味:纸张/黑板/手账的书写感 ----
  { group: '文字韵味', id: 'word-loveletter', label: '手写情书', bg: '#fffef6', text: '#9f1239', radius: '6px', border: '1px solid #fecdd3', extraClass: 'bubble-pat-letter bubble-tag-love', deco: [{ emoji: '💌', pos: 'br', size: 14 }] },
  { group: '文字韵味', id: 'word-chalk', label: '黑板粉笔', bg: '#2f4f43', text: '#f8fafc', textShadow: '0 0 1px rgba(255,255,255,0.45)', radius: '4px', border: '4px solid #8b5e34', extraClass: 'bubble-chalkboard', deco: [{ emoji: '🖍', pos: 'br', size: 13, rot: 30 }] },
  { group: '文字韵味', id: 'word-highlight', label: '荧光手账', bg: 'linear-gradient(0deg, #fef08a 0 42%, #ffffff 42%)', text: '#1c1917', radius: '4px', border: '1px solid #e7e5e4', deco: [{ emoji: '🖊', pos: 'tr', size: 13, rot: 40 }] },
  { group: '文字韵味', id: 'word-telegram', label: '加急电报', bg: '#fdf6e3', text: '#57534e', radius: '2px', border: '1px solid #d6d3d1', extraClass: 'bubble-stitch', deco: [{ emoji: '📮', pos: 'tr', size: 14 }] },
  // ---- 动态臻藏:每款一个专属动态特效(扫光/星闪/落雪/熔岩/涟漪/扫描…) ----
  { group: '动态臻藏', id: 'fx-platinum', label: '白金扫光', bg: 'linear-gradient(135deg, #e2e8f0, #f8fafc 45%, #cbd5e1)', text: '#334155', radius: '16px', extraClass: 'bubble-shimmer', border: '1px solid #e2e8f0' },
  { group: '动态臻藏', id: 'fx-goldsand', label: '鎏金流沙', bg: 'linear-gradient(135deg, #78350f, #451a03)', text: '#fde68a', radius: '16px', extraClass: 'bubble-shimmer', border: '1px solid #b45309' },
  { group: '动态臻藏', id: 'fx-nightstars', label: '星夜闪烁', bg: 'linear-gradient(135deg, #1e1b4b, #0f172a)', text: '#e0e7ff', radius: '18px', extraClass: 'bubble-stars', deco: [{ emoji: '🌙', pos: 'tr', size: 15, rot: 15 }] },
  { group: '动态臻藏', id: 'fx-snowdusk', label: '雪落黄昏', bg: 'linear-gradient(160deg, #7c6f9f, #3b3a5c)', text: '#f1f5f9', radius: '18px', extraClass: 'bubble-snowfall', deco: [{ emoji: '⛄', pos: 'br', size: 17 }] },
  { group: '动态臻藏', id: 'fx-sakurafall', label: '樱吹雪', bg: 'linear-gradient(160deg, #fdf2f8, #fce7f3)', text: '#9d174d', radius: '20px', extraClass: 'bubble-sakura', border: '1px solid #fbcfe8', deco: [{ emoji: '🌸', pos: 'tr', size: 15, rot: 15, anim: 'swing' }] },
  { group: '动态臻藏', id: 'fx-nightrain', label: '夜雨窗前', bg: 'linear-gradient(160deg, #1e293b, #0f172a)', text: '#bfdbfe', radius: '14px', extraClass: 'bubble-rain', deco: [{ emoji: '🌧', pos: 'tl', size: 15 }] },
  { group: '动态臻藏', id: 'fx-lava', label: '熔岩之心', bg: 'linear-gradient(135deg, #7f1d1d, #431407)', text: '#fed7aa', radius: '16px', extraClass: 'bubble-lava' },
  { group: '动态臻藏', id: 'fx-candle', label: '烛光晚餐', bg: 'linear-gradient(135deg, #451a03, #292524)', text: '#fde68a', radius: '18px', extraClass: 'bubble-candle', deco: [{ emoji: '🕯️', pos: 'tr', size: 16, anim: 'twinkle' }] },
  { group: '动态臻藏', id: 'fx-ripple', label: '湖心涟漪', bg: 'linear-gradient(135deg, #0e7490, #164e63)', text: '#cffafe', radius: '20px', extraClass: 'bubble-ripple' },
  { group: '动态臻藏', id: 'fx-firefly', label: '萤火仲夏', bg: 'linear-gradient(160deg, #14532d, #052e16)', text: '#d9f99d', radius: '18px', extraClass: 'bubble-firefly' },
  { group: '动态臻藏', id: 'fx-tide', label: '海浪拍岸', bg: 'linear-gradient(180deg, #38bdf8, #0284c7)', text: '#f0f9ff', radius: '18px', extraClass: 'bubble-wave' },
  { group: '动态臻藏', id: 'fx-cyberscan', label: '赛博扫描', bg: 'linear-gradient(135deg, #164e63, #0f172a)', text: '#67e8f9', radius: '8px', extraClass: 'bubble-scan', border: '1px solid #0e7490', textShadow: '0 0 6px rgba(103,232,249,0.6)' },
  { group: '动态臻藏', id: 'fx-goldring', label: '鎏金旋环', bg: 'linear-gradient(135deg, #1c1917, #292524)', text: '#fde68a', radius: '16px', extraClass: 'bubble-goldring' },
  { group: '动态臻藏', id: 'fx-soda', label: '汽水咕嘟', bg: 'linear-gradient(180deg, #67e8f9, #0ea5e9)', text: '#f0fdff', radius: '20px', extraClass: 'bubble-soda', deco: [{ emoji: '🥤', pos: 'tr', size: 16, anim: 'bob' }] },
  // ---- 节日限定 ----
  { group: '节日限定', id: 'fest-xmas', label: '圣诞雪夜', bg: 'linear-gradient(135deg, #14532d, #052e16)', text: '#fef9c3', radius: '16px', border: '1.5px solid #dc2626', extraClass: 'bubble-snowfall', deco: [{ emoji: '🎄', pos: 'tr', size: 18, anim: 'swing' }, { emoji: '🎁', pos: 'bl', size: 13 }] },
  { group: '节日限定', id: 'fest-newyear', label: '新年红包', bg: 'linear-gradient(135deg, #b91c1c, #7f1d1d)', text: '#fde68a', radius: '14px', border: '1.5px solid #fbbf24', extraClass: 'bubble-shimmer', deco: [{ emoji: '🧧', pos: 'tr', size: 17, anim: 'bob' }, { emoji: '🏮', pos: 'bl', size: 14, anim: 'swing' }] },
  { group: '节日限定', id: 'fest-halloween', label: '万圣魔夜', bg: 'linear-gradient(135deg, #431407, #1c1917)', text: '#fdba74', radius: '16px', extraClass: 'bubble-candle', deco: [{ emoji: '🎃', pos: 'br', size: 18, anim: 'bob' }, { emoji: '👻', pos: 'tl', size: 14, anim: 'float' }] },
  { group: '节日限定', id: 'fest-midautumn', label: '中秋月满', bg: 'linear-gradient(160deg, #1e1b4b, #312e81)', text: '#fef3c7', radius: '20px', extraClass: 'bubble-stars', deco: [{ emoji: '🌕', pos: 'tr', size: 18, anim: 'float' }, { emoji: '🥮', pos: 'bl', size: 14 }] },
  { group: '节日限定', id: 'fest-valentine', label: '情人玫瑰', bg: 'linear-gradient(135deg, #be123c, #881337)', text: '#fecdd3', radius: '18px', anim: 'bubble-beat', deco: [{ emoji: '🌹', pos: 'tr', size: 17, rot: 15 }, { emoji: '💘', pos: 'bl', size: 14, anim: 'pop' }] },
  { group: '节日限定', id: 'fest-qixi', label: '七夕鹊桥', bg: 'linear-gradient(135deg, #4c1d95, #1e1b4b)', text: '#f5d0fe', radius: '18px', extraClass: 'bubble-stars', deco: [{ emoji: '🌉', pos: 'bl', size: 15 }, { emoji: '💫', pos: 'tr', size: 15, anim: 'twinkle' }] },
  { group: '节日限定', id: 'fest-birthday', label: '生日派对', bg: 'linear-gradient(135deg, #f0abfc, #a855f7)', text: '#ffffff', radius: '18px', deco: [{ emoji: '🎂', pos: 'tr', size: 18, anim: 'bob' }, { emoji: '🎊', pos: 'bl', size: 14, anim: 'pop' }, { emoji: '🎈', pos: 'br', size: 12, anim: 'float' }] },
  { group: '节日限定', id: 'fest-lantern', label: '元宵灯会', bg: 'linear-gradient(135deg, #7f1d1d, #450a0a)', text: '#fef3c7', radius: '16px', extraClass: 'bubble-candle', deco: [{ emoji: '🏮', pos: 'tl', size: 17, anim: 'swing' }, { emoji: '🏮', pos: 'br', size: 13, anim: 'swing' }] },
  { group: '节日限定', id: 'fest-dragonboat', label: '端午龙舟', bg: 'linear-gradient(135deg, #15803d, #14532d)', text: '#ecfccb', radius: '16px', extraClass: 'bubble-wave', deco: [{ emoji: '🐉', pos: 'tr', size: 17, anim: 'wag' }, { emoji: '🍃', pos: 'bl', size: 13, anim: 'float' }] },
  { group: '节日限定', id: 'fest-thanks', label: '秋日感恩', bg: 'linear-gradient(135deg, #b45309, #7c2d12)', text: '#ffedd5', radius: '18px', deco: [{ emoji: '🍁', pos: 'tr', size: 16, rot: 20, anim: 'float' }, { emoji: '🦃', pos: 'bl', size: 15 }] },
  { group: '节日限定', id: 'fest-fireworks', label: '跨年烟花', bg: 'linear-gradient(160deg, #18181b, #312e81)', text: '#fbcfe8', radius: '16px', extraClass: 'bubble-stars', deco: [{ emoji: '🎆', pos: 'tr', size: 18, anim: 'pop' }, { emoji: '✨', pos: 'bl', size: 13, anim: 'twinkle' }] },
  { group: '节日限定', id: 'fest-wedding', label: '婚礼请柬', bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)', text: '#92400e', radius: '14px', border: '3px double #d4af37', extraClass: 'bubble-shimmer', deco: [{ emoji: '💍', pos: 'tr', size: 15, anim: 'twinkle' }] },
  // ---- 星辰宇宙 ----
  { group: '星辰宇宙', id: 'cos-deepspace', label: '深空星野', bg: 'radial-gradient(circle at 30% 20%, #312e81, #0f172a 70%)', text: '#e0e7ff', radius: '18px', extraClass: 'bubble-stars' },
  { group: '星辰宇宙', id: 'cos-galaxysweep', label: '银河扫光', bg: 'linear-gradient(135deg, #4c1d95, #1e1b4b)', text: '#ede9fe', radius: '18px', extraClass: 'bubble-shimmer', deco: [{ emoji: '🌌', pos: 'tr', size: 15 }] },
  { group: '星辰宇宙', id: 'cos-nebula', label: '玫瑰星云', bg: 'radial-gradient(circle at 70% 30%, #be185d, #4c1d95 75%)', text: '#fce7f3', radius: '20px', extraClass: 'bubble-stars' },
  { group: '星辰宇宙', id: 'cos-moon', label: '月球漫步', bg: 'linear-gradient(135deg, #d6d3d1, #a8a29e)', text: '#292524', radius: '999px', deco: [{ emoji: '🧑‍🚀', pos: 'tr', size: 17, anim: 'float' }, { emoji: '🌑', pos: 'bl', size: 12 }] },
  { group: '星辰宇宙', id: 'cos-mars', label: '火星基地', bg: 'linear-gradient(135deg, #c2410c, #7c2d12)', text: '#ffedd5', radius: '14px', deco: [{ emoji: '🛸', pos: 'tl', size: 16, anim: 'float' }, { emoji: '👽', pos: 'br', size: 13, anim: 'bob' }] },
  { group: '星辰宇宙', id: 'cos-blackhole', label: '黑洞边缘', bg: 'radial-gradient(circle at 50% 120%, #57534e 0%, #0c0a09 55%)', text: '#e7e5e4', radius: '20px', extraClass: 'bubble-goldring' },
  { group: '星辰宇宙', id: 'cos-comet', label: '彗星拖尾', bg: 'linear-gradient(115deg, #0ea5e9, #1e1b4b 65%)', text: '#e0f2fe', radius: '999px 18px 18px 999px', extraClass: 'bubble-shimmer', deco: [{ emoji: '☄️', pos: 'tl', size: 17, rot: -20 }] },
  { group: '星辰宇宙', id: 'cos-aurora-sky', label: '极光之夜', bg: 'linear-gradient(160deg, #052e16, #0f172a)', text: '#a7f3d0', radius: '18px', extraClass: 'bubble-firefly', deco: [{ emoji: '🏔', pos: 'br', size: 15 }] },
  // ---- 国风雅韵 ----
  { group: '国风雅韵', id: 'cn-vermilion', label: '朱砂宫墙', bg: 'linear-gradient(135deg, #b91c1c, #7f1d1d)', text: '#fef3c7', radius: '6px', border: '3px double #fbbf24', deco: [{ emoji: '🀄', pos: 'br', size: 13 }] },
  { group: '国风雅韵', id: 'cn-porcelain', label: '青花瓷', bg: '#f8fafc', text: '#1e40af', radius: '14px', border: '2px solid #1e40af', extraClass: 'bubble-pat-porcelain', shadow: 'inset 0 0 0 4px #f8fafc, inset 0 0 0 5px rgba(30,64,175,0.4)' },
  { group: '国风雅韵', id: 'cn-ink', label: '水墨丹青', bg: 'linear-gradient(160deg, #f5f5f4, #d6d3d1)', text: '#1c1917', radius: '255px 15px 225px 15px / 15px 225px 15px 255px', deco: [{ emoji: '🖌️', pos: 'tr', size: 15, rot: 30 }] },
  { group: '国风雅韵', id: 'cn-cloudgold', label: '鎏金祥云', bg: '#292524', text: '#fde68a', radius: '16px', extraClass: 'bubble-pat-rings', border: '1px solid #a16207' },
  { group: '国风雅韵', id: 'cn-bamboo', label: '竹林听雨', bg: 'linear-gradient(135deg, #166534, #14532d)', text: '#d9f99d', radius: '4px 18px 4px 18px', extraClass: 'bubble-rain', deco: [{ emoji: '🎋', pos: 'tr', size: 16, anim: 'swing' }] },
  { group: '国风雅韵', id: 'cn-peachnote', label: '桃花笺', bg: '#fff1f2', text: '#9f1239', radius: '4px', border: '1px solid #fda4af', extraClass: 'bubble-pat-letter', deco: [{ emoji: '🌸', pos: 'tr', size: 13, rot: 15 }] },
  { group: '国风雅韵', id: 'cn-dunhuang', label: '敦煌飞天', bg: 'linear-gradient(135deg, #c2410c, #9a3412 55%, #155e75)', text: '#fef3c7', radius: '18px', extraClass: 'bubble-shimmer', deco: [{ emoji: '🪷', pos: 'bl', size: 14, anim: 'float' }] },
  { group: '国风雅韵', id: 'cn-jade', label: '和田翡翠', bg: 'linear-gradient(135deg, #10b981, #047857)', text: '#ecfdf5', radius: '999px', shadow: 'inset 0 2px 8px rgba(255,255,255,0.45), 0 3px 10px -4px rgba(4,120,87,0.7)' },
  { group: '国风雅韵', id: 'cn-plumsnow', label: '红梅映雪', bg: '#fafafa', text: '#9f1239', radius: '18px', border: '1.5px solid #fecdd3', extraClass: 'bubble-snowfall', deco: [{ emoji: '🌺', pos: 'tl', size: 15, rot: -15 }] },
  { group: '国风雅韵', id: 'cn-palace', label: '夜游宫灯', bg: 'linear-gradient(160deg, #1c1917, #292524)', text: '#fdba74', radius: '14px', extraClass: 'bubble-candle', deco: [{ emoji: '🏮', pos: 'tr', size: 16, anim: 'swing' }, { emoji: '🌙', pos: 'bl', size: 12 }] },
  // ---- 甜品屋 ----
  { group: '甜品屋', id: 'sweet-strawcake', label: '草莓蛋糕', bg: 'linear-gradient(180deg, #fff1f2 0 40%, #fda4af 40% 55%, #fff1f2 55%)', text: '#be123c', radius: '18px', deco: [{ emoji: '🍓', pos: 'tr', size: 16, anim: 'bob' }, { emoji: '🍰', pos: 'bl', size: 14 }] },
  { group: '甜品屋', id: 'sweet-matcha', label: '抹茶红豆', bg: 'linear-gradient(135deg, #84cc16, #4d7c0f)', text: '#f7fee7', radius: '20px', deco: [{ emoji: '🍵', pos: 'tr', size: 16 }, { emoji: '🫘', pos: 'bl', size: 12 }] },
  { group: '甜品屋', id: 'sweet-choco', label: '巧克力熔岩', bg: 'linear-gradient(135deg, #44403c, #292524)', text: '#fed7aa', radius: '18px', extraClass: 'bubble-lava', deco: [{ emoji: '🍫', pos: 'tr', size: 15, rot: 15 }] },
  { group: '甜品屋', id: 'sweet-pudding', label: '焦糖布丁', bg: 'linear-gradient(180deg, #92400e 0 30%, #fbbf24 30%)', text: '#78350f', radius: '10px 10px 20px 20px', deco: [{ emoji: '🍮', pos: 'tr', size: 16, anim: 'bob' }] },
  { group: '甜品屋', id: 'sweet-macaron', label: '薄荷马卡龙', bg: 'linear-gradient(180deg, #a7f3d0 0 42%, #fdf2f8 42% 58%, #a7f3d0 58%)', text: '#065f46', radius: '999px', deco: [{ emoji: '🧁', pos: 'br', size: 15 }] },
  { group: '甜品屋', id: 'sweet-peachsoda', label: '蜜桃气泡水', bg: 'linear-gradient(180deg, #fecdd3, #fda4af)', text: '#9f1239', radius: '20px', extraClass: 'bubble-soda', deco: [{ emoji: '🍑', pos: 'tr', size: 16, anim: 'bob' }] },
  { group: '甜品屋', id: 'sweet-donut', label: '糖霜甜甜圈', bg: '#f9a8d4', text: '#831843', radius: '999px', extraClass: 'bubble-pat-sprinkle', deco: [{ emoji: '🍩', pos: 'tr', size: 16, anim: 'spin' }] },
  { group: '甜品屋', id: 'sweet-icecream', label: '冰淇淋旋涡', bg: 'linear-gradient(135deg, #fbcfe8, #bfdbfe 50%, #fef3c7)', text: '#6b21a8', radius: '24px', deco: [{ emoji: '🍦', pos: 'tr', size: 16 }] },
  { group: '甜品屋', id: 'sweet-cotton', label: '棉花糖云', bg: '#fce7f3', text: '#be185d', radius: '999px', extraClass: 'bubble-pat-dots', deco: [{ emoji: '🍬', pos: 'bl', size: 13, rot: -20 }] },
  { group: '甜品屋', id: 'sweet-honey', label: '蜂蜜吐司', bg: 'linear-gradient(180deg, #fde68a, #f59e0b)', text: '#78350f', radius: '12px', deco: [{ emoji: '🍯', pos: 'tr', size: 16, anim: 'bob' }, { emoji: '🐝', pos: 'bl', size: 12, anim: 'float' }] },
  // ---- 海洋物语 ----
  { group: '海洋物语', id: 'sea-surf', label: '碧海浪花', bg: 'linear-gradient(180deg, #22d3ee, #0369a1)', text: '#ecfeff', radius: '20px', extraClass: 'bubble-wave', deco: [{ emoji: '🌊', pos: 'tl', size: 14 }] },
  { group: '海洋物语', id: 'sea-abyss', label: '深海之光', bg: 'linear-gradient(180deg, #164e63, #082f49)', text: '#a5f3fc', radius: '20px', extraClass: 'bubble-soda', deco: [{ emoji: '🐋', pos: 'br', size: 17, anim: 'float' }] },
  { group: '海洋物语', id: 'sea-coral', label: '珊瑚礁', bg: 'linear-gradient(135deg, #fb7185, #f97316)', text: '#fff7ed', radius: '22px 8px 22px 8px', deco: [{ emoji: '🐠', pos: 'tr', size: 16, anim: 'wag' }, { emoji: '🪸', pos: 'bl', size: 14 }] },
  { group: '海洋物语', id: 'sea-jelly', label: '水母漂浮', bg: 'linear-gradient(180deg, rgba(196,181,253,0.75), rgba(129,140,248,0.75))', text: '#ffffff', radius: '24px 24px 12px 12px', extraClass: 'bubble-glass bubble-jelly', deco: [{ emoji: '🪼', pos: 'tr', size: 17, anim: 'float' }] },
  { group: '海洋物语', id: 'sea-beach', label: '沙滩椰风', bg: 'linear-gradient(180deg, #7dd3fc 0 55%, #fde68a 55%)', text: '#0c4a6e', radius: '16px', deco: [{ emoji: '🌴', pos: 'tr', size: 17, anim: 'swing' }, { emoji: '🐚', pos: 'bl', size: 12 }] },
  { group: '海洋物语', id: 'sea-mermaid', label: '人鱼之泪', bg: 'linear-gradient(135deg, #67e8f9, #a78bfa, #f0abfc)', text: '#4c1d95', radius: '22px', extraClass: 'bubble-shimmer', anim: 'bubble-flow' },
  { group: '海洋物语', id: 'sea-sail', label: '扬帆远航', bg: 'linear-gradient(180deg, #bae6fd 0 60%, #0ea5e9 60%)', text: '#0c4a6e', radius: '16px', extraClass: 'bubble-wave', deco: [{ emoji: '⛵', pos: 'tr', size: 17, anim: 'swing' }] },
  // ---- 图案纹样 ----
  { group: '图案纹样', id: 'pat-polka', label: '波点少女', bg: '#fb7185', text: '#ffffff', radius: '20px', extraClass: 'bubble-pat-dots' },
  { group: '图案纹样', id: 'pat-milkstripe', label: '奶油条纹', bg: '#fef3c7', text: '#92400e', radius: '18px', border: '1.5px solid #fde68a', extraClass: 'bubble-pat-stripes' },
  { group: '图案纹样', id: 'pat-candy', label: '糖果斜纹', bg: '#f472b6', text: '#ffffff', radius: '999px', extraClass: 'bubble-pat-candy' },
  { group: '图案纹样', id: 'pat-check', label: '棋盘格', bg: '#fafaf9', text: '#44403c', radius: '10px', border: '1.5px solid #d6d3d1', extraClass: 'bubble-pat-check' },
  { group: '图案纹样', id: 'pat-plaid', label: '英伦格纹', bg: '#7f1d1d', text: '#fef2f2', radius: '10px', extraClass: 'bubble-pat-plaid' },
  { group: '图案纹样', id: 'pat-zigzag', label: '针织毛衣', bg: '#c2410c', text: '#ffedd5', radius: '14px', extraClass: 'bubble-pat-zigzag' },
  { group: '图案纹样', id: 'pat-starprint', label: '星星满印', bg: '#312e81', text: '#e0e7ff', radius: '16px', extraClass: 'bubble-pat-stardots' },
  { group: '图案纹样', id: 'pat-rainbowstripe', label: '彩虹条纹', bg: '#ffffff', text: '#475569', radius: '18px', border: '1px solid #e2e8f0', extraClass: 'bubble-pat-rainbow' },
  { group: '图案纹样', id: 'pat-lace', label: '蕾丝花边', bg: '#fdf2f8', text: '#9d174d', radius: '18px', border: '2px dashed #f9a8d4', shadow: 'inset 0 0 0 3px #fdf2f8, inset 0 0 0 4.5px #fbcfe8' },
  { group: '图案纹样', id: 'pat-grid-note', label: '方格笔记', bg: '#ffffff', text: '#334155', radius: '6px', border: '1px solid #e2e8f0', extraClass: 'bubble-pat-grid' },
  // ---- 金属光泽 ----
  { group: '金属光泽', id: 'metal-gold', label: '流金岁月', bg: 'linear-gradient(135deg, #b45309, #fbbf24 45%, #92400e)', text: '#fffbeb', radius: '14px', extraClass: 'bubble-shimmer' },
  { group: '金属光泽', id: 'metal-silver', label: '月光白银', bg: 'linear-gradient(135deg, #94a3b8, #f1f5f9 45%, #94a3b8)', text: '#1e293b', radius: '14px', extraClass: 'bubble-shimmer' },
  { group: '金属光泽', id: 'metal-rose', label: '玫瑰金属', bg: 'linear-gradient(135deg, #be7b6b, #fecdd3 45%, #b76e79)', text: '#7c2d12', radius: '14px', extraClass: 'bubble-shimmer' },
  { group: '金属光泽', id: 'metal-chrome', label: '赛博铬', bg: 'linear-gradient(135deg, #64748b, #e2e8f0 40%, #334155 75%)', text: '#0f172a', radius: '8px', extraClass: 'bubble-shimmer', border: '1px solid #94a3b8' },
  { group: '金属光泽', id: 'metal-titanium', label: '钛晶紫', bg: 'linear-gradient(135deg, #6d28d9, #c4b5fd 45%, #4c1d95)', text: '#f5f3ff', radius: '14px', extraClass: 'bubble-shimmer' },
  { group: '金属光泽', id: 'metal-champagne', label: '香槟金', bg: 'linear-gradient(135deg, #d6c197, #f5e7c6 45%, #bfa87e)', text: '#713f12', radius: '18px', extraClass: 'bubble-shimmer' },
  // ---- 创意造型:纯 CSS/SVG 手绘外形(气泡长出耳朵/角/皇冠+对话尾巴尖,不靠 emoji) ----
  { group: '创意造型', id: 'art-cat', label: '猫耳朵', bg: '#fcd9b6', text: '#7c2d12', accent: '#fcd9b6', topper: 'cat', tail: true, radius: '20px' },
  { group: '创意造型', id: 'art-bear', label: '小熊耳', bg: '#d8a679', text: '#ffffff', accent: '#d8a679', topper: 'bear', tail: true, radius: '22px' },
  { group: '创意造型', id: 'art-bunny', label: '兔耳朵', bg: '#fbcfe8', text: '#9d174d', accent: '#fbcfe8', topper: 'bunny', tail: true, radius: '22px' },
  { group: '创意造型', id: 'art-fox', label: '狐狸耳', bg: '#fb923c', text: '#ffffff', accent: '#fb923c', topper: 'fox', tail: true, radius: '18px' },
  { group: '创意造型', id: 'art-panda', label: '熊猫头', bg: '#ffffff', text: '#374151', accent: '#1f2937', topper: 'panda', tail: true, radius: '22px', border: '1.5px solid #e5e7eb' },
  { group: '创意造型', id: 'art-devil', label: '小恶魔', bg: 'linear-gradient(135deg, #7c3aed, #4c1d95)', text: '#ffffff', accent: '#dc2626', topper: 'devil', tail: true, radius: '16px' },
  { group: '创意造型', id: 'art-crown', label: '小皇冠', bg: '#fef3c7', text: '#92400e', accent: '#f59e0b', topper: 'crown', tail: true, radius: '14px' },
  { group: '创意造型', id: 'art-king', label: '黑金国王', bg: 'linear-gradient(135deg, #1e293b, #0f172a)', text: '#fde68a', accent: '#fbbf24', topper: 'crown', tail: true, radius: '12px' },
  { group: '创意造型', id: 'art-antenna', label: '天线宝宝', bg: '#6ee7b7', text: '#065f46', accent: '#059669', topper: 'antenna', tail: true, radius: '20px' },
  { group: '创意造型', id: 'art-sprout', label: '冒芽芽', bg: '#dcfce7', text: '#166534', accent: '#22c55e', topper: 'sprout', tail: true, radius: '20px' },
  { group: '创意造型', id: 'art-halo', label: '小天使', bg: 'linear-gradient(135deg, #e0f2fe, #ede9fe)', text: '#4338ca', accent: '#facc15', topper: 'halo', tail: true, radius: '22px' },
  { group: '创意造型', id: 'art-speech', label: '经典对话', bg: '#ffffff', text: '#111827', accent: '#ffffff', tail: true, radius: '16px', border: '2px solid #111827', shadow: '2px 2px 0 #111827' },
  { group: '创意造型', id: 'art-speech-pink', label: '粉漫对话', bg: '#fff1f2', text: '#9f1239', accent: '#fff1f2', tail: true, radius: '16px', border: '2px solid #fb7185' },
  // ---- 灵动:整只气泡 + 挂件一起动起来 ----
  { group: '灵动', id: 'live-jelly', label: '果冻弹弹', bg: 'linear-gradient(135deg, #fda4af, #fb7185)', text: '#ffffff', radius: '22px', extraClass: 'bubble-jelly', deco: [{ emoji: '🍮', pos: 'tr', size: 18, anim: 'bob' }] },
  { group: '灵动', id: 'live-bounce', label: '蹦跶小球', bg: 'linear-gradient(135deg, #fdba74, #fb923c)', text: '#ffffff', radius: '999px', deco: [{ emoji: '🏀', pos: 'tr', size: 20, anim: 'bob' }, { emoji: '✨', pos: 'bl', size: 12, anim: 'twinkle' }] },
  { group: '灵动', id: 'live-meteor', label: '流星划过', bg: 'linear-gradient(135deg, #312e81, #1e1b4b)', text: '#e0e7ff', extraClass: 'bubble-flow', deco: [{ emoji: '🌠', pos: 'tr', size: 20, anim: 'float' }, { emoji: '⭐', pos: 'bl', size: 11, anim: 'twinkle' }] },
  { group: '灵动', id: 'live-bubbletea', label: '波波奶茶', bg: 'linear-gradient(135deg, #e7c6a8, #a47148)', text: '#fff7ed', radius: '8px 8px 18px 18px', deco: [{ emoji: '🧋', pos: 'tr', size: 20, anim: 'swing' }, { emoji: '🫧', pos: 'bl', size: 12, anim: 'rise' }] },
  { group: '灵动', id: 'live-cloud', label: '棉花云朵', bg: 'linear-gradient(135deg, #e0f2fe, #ffffff)', text: '#0369a1', radius: '999px', border: '1.5px solid #bae6fd', extraClass: 'bubble-jelly', deco: [{ emoji: '☁️', pos: 'tl', size: 18, anim: 'float' }, { emoji: '💧', pos: 'br', size: 12, anim: 'rise' }] },
  { group: '灵动', id: 'live-fire', label: '燃烧吧', bg: 'linear-gradient(135deg, #f59e0b, #ef4444)', text: '#fff7ed', anim: 'bubble-flow', deco: [{ emoji: '🔥', pos: 'tr', size: 20, anim: 'twinkle' }] },
  { group: '灵动', id: 'live-party', label: '派对气球', bg: 'linear-gradient(135deg, #f0abfc, #d946ef)', text: '#ffffff', radius: '20px', deco: [{ emoji: '🎈', pos: 'tr', size: 20, anim: 'float' }, { emoji: '🎉', pos: 'bl', size: 15, anim: 'pop' }] },
  { group: '灵动', id: 'live-snow', label: '飘雪精灵', bg: 'linear-gradient(135deg, #e0f2fe, #c7d2fe)', text: '#3730a3', deco: [{ emoji: '❄️', pos: 'tl', size: 15, anim: 'spin' }, { emoji: '⛄', pos: 'br', size: 18, anim: 'bob' }] },
  { group: '灵动', id: 'live-loveletter', label: '飞吻信封', bg: 'linear-gradient(135deg, #fecdd3, #fb7185)', text: '#ffffff', radius: '6px', deco: [{ emoji: '💌', pos: 'tr', size: 19, anim: 'bob' }, { emoji: '💋', pos: 'bl', size: 13, anim: 'pop' }] },
  { group: '灵动', id: 'live-galaxy', label: '旋转星系', bg: 'linear-gradient(135deg, #6d28d9, #4338ca, #6d28d9)', text: '#ede9fe', anim: 'bubble-flow', deco: [{ emoji: '🪐', pos: 'tr', size: 20, anim: 'spin' }, { emoji: '✨', pos: 'bl', size: 12, anim: 'twinkle' }] },
  { group: '灵动', id: 'live-heartbeat', label: '砰砰心跳', bg: 'linear-gradient(135deg, var(--c-primary), var(--c-primary-dark))', text: '#ffffff', anim: 'bubble-beat', deco: [{ emoji: '💓', pos: 'tr', size: 18, anim: 'pop' }] },
  { group: '灵动', id: 'live-blossom', label: '花瓣纷飞', bg: 'linear-gradient(135deg, #fdf2f8, #fbcfe8)', text: '#9d174d', deco: [{ emoji: '🌸', pos: 'tl', size: 14, rot: -10, anim: 'spin' }, { emoji: '🌷', pos: 'br', size: 16, anim: 'swing' }, { emoji: '🌸', pos: 'tr', size: 11, anim: 'float' }] },
  // ---- 萌宠挂件:小动物在气泡边探头(会动) ----
  { group: '萌宠挂件', id: 'pet-cat', label: '猫猫探头', bg: '#fff7ed', text: '#9a3412', border: '1.5px solid #fdba74', deco: [{ emoji: '🐱', pos: 'tr', size: 22, rot: 12, anim: 'bob' }, { emoji: '🐾', pos: 'bl', size: 13, rot: -15, anim: 'twinkle' }] },
  { group: '萌宠挂件', id: 'pet-bunny', label: '兔兔蹲守', bg: '#fdf2f8', text: '#be185d', border: '1.5px solid #f9a8d4', deco: [{ emoji: '🐰', pos: 'tr', size: 22, anim: 'bob' }, { emoji: '🥕', pos: 'bl', size: 13, rot: 30, anim: 'swing' }] },
  { group: '萌宠挂件', id: 'pet-bear', label: '小熊抱抱', bg: '#fef3c7', text: '#92400e', border: '1.5px solid #fcd34d', deco: [{ emoji: '🐻', pos: 'br', size: 22, rot: -8, anim: 'swing' }, { emoji: '🍯', pos: 'tl', size: 13, anim: 'float' }] },
  { group: '萌宠挂件', id: 'pet-shiba', label: '柴犬歪头', bg: '#fffbeb', text: '#b45309', border: '1.5px solid #fde68a', deco: [{ emoji: '🐶', pos: 'tl', size: 22, rot: -12, anim: 'swing' }, { emoji: '🦴', pos: 'br', size: 13, rot: 20, anim: 'wag' }] },
  { group: '萌宠挂件', id: 'pet-pig', label: '猪猪软糯', bg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', text: '#9d174d', radius: '22px 22px 22px 22px', deco: [{ emoji: '🐷', pos: 'br', size: 22, anim: 'bob' }, { emoji: '💗', pos: 'tl', size: 12, anim: 'pop' }] },
  { group: '萌宠挂件', id: 'pet-shark', label: '鲨鲨咬住', bg: '#e0f2fe', text: '#075985', border: '1.5px solid #7dd3fc', deco: [{ emoji: '🦈', pos: 'tl', size: 24, rot: 18, anim: 'wag' }, { emoji: '💦', pos: 'br', size: 13, anim: 'twinkle' }] },
  { group: '萌宠挂件', id: 'pet-chick', label: '小鸡叽叽', bg: '#fefce8', text: '#854d0e', border: '1.5px solid #fef08a', deco: [{ emoji: '🐥', pos: 'tr', size: 21, anim: 'bob' }, { emoji: '🌾', pos: 'bl', size: 13, rot: -20, anim: 'swing' }] },
  { group: '萌宠挂件', id: 'pet-frog', label: '蛙蛙偷看', bg: '#f0fdf4', text: '#166534', border: '1.5px solid #86efac', deco: [{ emoji: '🐸', pos: 'bl', size: 21, anim: 'bob' }, { emoji: '🪷', pos: 'tr', size: 13, anim: 'float' }] },
  { group: '萌宠挂件', id: 'pet-seal', label: '海豹趴趴', bg: '#ecfeff', text: '#155e75', border: '1.5px solid #a5f3fc', deco: [{ emoji: '🦭', pos: 'br', size: 22, rot: -10, anim: 'swing' }, { emoji: '🫧', pos: 'tl', size: 13, anim: 'rise' }] },
  { group: '萌宠挂件', id: 'pet-ghost', label: '幽灵飘飘', bg: 'linear-gradient(135deg, #3f3f46, #27272a)', text: '#e4e4e7', deco: [{ emoji: '👻', pos: 'tr', size: 22, rot: 10, anim: 'float' }, { emoji: '✨', pos: 'bl', size: 12, anim: 'twinkle' }] },
  { group: '萌宠挂件', id: 'pet-devil', label: '小恶魔', bg: 'linear-gradient(135deg, #450a0a, #1c1917)', text: '#fca5a5', deco: [{ emoji: '😈', pos: 'br', size: 21, anim: 'bob' }, { emoji: '🔥', pos: 'tl', size: 13, anim: 'twinkle' }] },
  { group: '萌宠挂件', id: 'pet-angel', label: '小天使', bg: 'linear-gradient(135deg, #eff6ff, #e0e7ff)', text: '#3730a3', border: '1.5px solid #c7d2fe', deco: [{ emoji: '😇', pos: 'tr', size: 21, anim: 'float' }, { emoji: '☁️', pos: 'bl', size: 14, anim: 'swing' }] },
  // ---- 少女装饰(会动) ----
  { group: '少女装饰', id: 'deco-ribbon', label: '蝴蝶结', bg: '#fff1f2', text: '#be123c', border: '1.5px solid #fda4af', deco: [{ emoji: '🎀', pos: 'tl', size: 20, rot: -15, anim: 'swing' }] },
  { group: '少女装饰', id: 'deco-sakura', label: '樱花飞舞', bg: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', text: '#9d174d', deco: [{ emoji: '🌸', pos: 'tr', size: 18, rot: 15, anim: 'spin' }, { emoji: '🌸', pos: 'bl', size: 12, rot: -20, anim: 'float' }] },
  { group: '少女装饰', id: 'deco-star', label: '星星魔法', bg: 'linear-gradient(135deg, #fef9c3, #fde68a)', text: '#854d0e', deco: [{ emoji: '⭐', pos: 'tl', size: 16, rot: -10, anim: 'twinkle' }, { emoji: '✨', pos: 'br', size: 15, anim: 'twinkle' }] },
  { group: '少女装饰', id: 'deco-butterfly', label: '蝴蝶停驻', bg: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', text: '#6d28d9', deco: [{ emoji: '🦋', pos: 'tr', size: 19, rot: 20, anim: 'float' }] },
  { group: '少女装饰', id: 'deco-music', label: '音符飘扬', bg: '#f8fafc', text: '#334155', border: '1.5px solid #cbd5e1', deco: [{ emoji: '🎵', pos: 'tr', size: 16, rot: 10, anim: 'rise' }, { emoji: '🎶', pos: 'bl', size: 13, rot: -10, anim: 'float' }] },
  { group: '少女装饰', id: 'deco-hearts', label: '爱心爆棚', bg: 'linear-gradient(135deg, #ffe4e6, #fecdd3)', text: '#be123c', deco: [{ emoji: '💕', pos: 'tl', size: 16, rot: -12, anim: 'pop' }, { emoji: '💖', pos: 'br', size: 16, rot: 12, anim: 'pop' }, { emoji: '💗', pos: 'tr', size: 12, anim: 'rise' }] },
  { group: '少女装饰', id: 'deco-berry', label: '草莓甜心', bg: '#fff1f2', text: '#b91c1c', border: '1.5px solid #fecaca', deco: [{ emoji: '🍓', pos: 'br', size: 18, rot: 15, anim: 'bob' }] },
  { group: '少女装饰', id: 'deco-peachy', label: '蜜桃乌龙', bg: 'linear-gradient(135deg, #fff7ed, #ffedd5)', text: '#c2410c', deco: [{ emoji: '🍑', pos: 'br', size: 18, anim: 'bob' }, { emoji: '🧋', pos: 'tl', size: 14, rot: -10, anim: 'swing' }] },
  { group: '少女装饰', id: 'deco-rainbow', label: '彩虹之上', bg: 'linear-gradient(135deg, #fef2f2, #eff6ff)', text: '#475569', deco: [{ emoji: '🌈', pos: 'tl', size: 18, anim: 'float' }, { emoji: '☁️', pos: 'br', size: 14, anim: 'float' }] },
  { group: '少女装饰', id: 'deco-cloudshape', label: '软绵云朵', bg: '#ffffff', text: '#0369a1', radius: '999px', border: '1.5px solid #e0f2fe', extraClass: 'bubble-cloud-shape' },
  { group: '少女装饰', id: 'deco-moon', label: '月夜星辰', bg: 'linear-gradient(135deg, #1e1b4b, #312e81)', text: '#e0e7ff', deco: [{ emoji: '🌙', pos: 'tr', size: 17, rot: 15, anim: 'swing' }, { emoji: '⭐', pos: 'bl', size: 12, anim: 'twinkle' }] },
  // ---- 异形边框 ----
  { group: '异形边框', id: 'shape-boom', label: '漫画爆炸', bg: '#fde047', text: '#1c1917', radius: '0px', extraClass: 'bubble-boom', deco: [{ emoji: '💥', pos: 'tr', size: 16, anim: 'pop' }] },
  { group: '异形边框', id: 'shape-pill', label: '胶囊', bg: 'linear-gradient(135deg, var(--c-primary), var(--c-primary-dark))', text: '#ffffff', radius: '999px' },
  { group: '异形边框', id: 'shape-drop', label: '水滴', bg: 'linear-gradient(135deg, #7dd3fc, #3b82f6)', text: '#ffffff', radius: '28px 28px 6px 28px' },
  { group: '异形边框', id: 'shape-leaf', label: '叶片', bg: 'linear-gradient(135deg, #86efac, #16a34a)', text: '#ffffff', radius: '28px 6px 28px 6px' },
  { group: '异形边框', id: 'shape-double', label: '复古双线', bg: '#fffbf5', text: '#7c2d12', border: '4px double #c2410c', radius: '14px' },
  { group: '异形边框', id: 'shape-stamp', label: '邮票边', bg: '#fffdf7', text: '#57534e', border: '2px dashed #d6d3d1', radius: '8px' },
  { group: '异形边框', id: 'shape-comic', label: '漫画黑框', bg: '#ffffff', text: '#111827', border: '2.5px solid #111827', radius: '16px', shadow: '3px 3px 0 #111827' },
  { group: '异形边框', id: 'shape-pixel', label: '像素8bit', bg: '#312e81', text: '#a5f3fc', radius: '0px', shadow: '4px 0 0 #312e81, -4px 0 0 #312e81, 0 4px 0 #312e81, 0 -4px 0 #312e81' },
  { group: '异形边框', id: 'shape-sketchy', label: '手绘涂鸦', bg: '#fffef8', text: '#374151', border: '2px solid #374151', radius: '255px 15px 225px 15px / 15px 225px 15px 255px' },
  { group: '异形边框', id: 'shape-flip', label: '反向圆角', bg: 'linear-gradient(135deg, #f9a8d4, #ec4899)', text: '#ffffff', radius: '6px 28px 28px 28px' },
  { group: '异形边框', id: 'shape-seal', label: '印章红框', bg: '#fef2f2', text: '#991b1b', border: '3px solid #dc2626', radius: '6px', shadow: 'inset 0 0 0 1.5px #fef2f2, inset 0 0 0 3px #dc2626' },
  // ---- 氛围质感 ----
  { group: '氛围质感', id: 'tex-glass', label: '玻璃拟态', bg: 'rgba(255,255,255,0.4)', text: '#1f2937', border: '1px solid rgba(255,255,255,0.7)', extraClass: 'bubble-glass' },
  { group: '氛围质感', id: 'tex-lawn', label: '后院草坪', bg: 'linear-gradient(180deg, #4ade80 0 9px, #8b5a2b 9px)', text: '#fef9c3', radius: '10px', deco: [{ emoji: '🌱', pos: 'tl', size: 14, rot: -10 }] },
  { group: '氛围质感', id: 'tex-wood', label: '原木板', bg: 'repeating-linear-gradient(90deg, #a9744f 0 20px, #9a6845 20px 22px)', text: '#fff7ed', radius: '10px', shadow: 'inset 0 0 0 2px #7c4a21' },
  { group: '氛围质感', id: 'tex-gingham', label: '格子布', bg: '#ffffff', text: '#be123c', border: '1.5px solid #fda4af', extraClass: 'bubble-pat-gingham' },
  { group: '氛围质感', id: 'tex-letter', label: '信纸', bg: '#fffef6', text: '#44403c', border: '1px solid #e7e5e4', extraClass: 'bubble-pat-letter' },
  { group: '氛围质感', id: 'tex-blackgold', label: '黑金奢华', bg: 'linear-gradient(135deg, #1c1917, #0c0a09)', text: '#f5d061', border: '1px solid #d4af37' },
  { group: '氛围质感', id: 'tex-denim', label: '牛仔布', bg: 'repeating-linear-gradient(45deg, #4a6da7 0 4px, #41619c 4px 8px)', text: '#eff6ff', shadow: 'inset 0 0 0 2px #34518a', radius: '12px' },
  { group: '氛围质感', id: 'tex-plush', label: '毛绒绒', bg: '#fda4af', text: '#881337', radius: '24px', extraClass: 'bubble-pat-dots' },
  { group: '氛围质感', id: 'tex-glitch', label: '故障入侵', bg: '#18181b', text: '#f4f4f5', extraClass: 'bubble-glitch', radius: '6px' },
  { group: '氛围质感', id: 'tex-holo', label: '全息镭射', bg: 'linear-gradient(135deg, #f0abfc, #67e8f9, #fde68a, #f0abfc)', text: '#581c87', anim: 'bubble-flow' },
  // ---- 渐变 ----
  { group: '渐变', id: 'theme', label: '主题渐变', bg: 'linear-gradient(135deg, var(--c-primary), var(--c-primary-dark))', text: '#ffffff' },
  { group: '渐变', id: 'peach', label: '蜜桃', bg: 'linear-gradient(135deg, #fda4af, #fb7185)', text: '#ffffff' },
  { group: '渐变', id: 'sakura', label: '樱花', bg: 'linear-gradient(135deg, #fbcfe8, #f472b6)', text: '#ffffff' },
  { group: '渐变', id: 'dawn', label: '黎明', bg: 'linear-gradient(135deg, #fecaca, #f87171)', text: '#ffffff' },
  { group: '渐变', id: 'rose', label: '蔷薇', bg: 'linear-gradient(135deg, #fecdd3, #e11d48)', text: '#ffffff' },
  { group: '渐变', id: 'rosegold', label: '玫瑰金', bg: 'linear-gradient(135deg, #f9a8d4, #fb7185 55%, #f59e0b)', text: '#ffffff' },
  { group: '渐变', id: 'berry', label: '莓果', bg: 'linear-gradient(135deg, #f472b6, #be185d)', text: '#ffffff' },
  { group: '渐变', id: 'dragonfruit', label: '火龙果', bg: 'linear-gradient(135deg, #f472b6, #9d174d)', text: '#ffffff' },
  { group: '渐变', id: 'peachviolet', label: '桃紫', bg: 'linear-gradient(135deg, #f0abfc, #c026d3)', text: '#ffffff' },
  { group: '渐变', id: 'sunset', label: '日落', bg: 'linear-gradient(135deg, #fdba74, #f472b6)', text: '#ffffff' },
  { group: '渐变', id: 'coral', label: '珊瑚', bg: 'linear-gradient(135deg, #fb923c, #ef4444)', text: '#ffffff' },
  { group: '渐变', id: 'tangerine', label: '蜜橘', bg: 'linear-gradient(135deg, #fdba74, #fb923c)', text: '#ffffff' },
  { group: '渐变', id: 'autumn', label: '金秋', bg: 'linear-gradient(135deg, #fcd34d, #d97706)', text: '#ffffff' },
  { group: '渐变', id: 'lemon', label: '柠檬', bg: 'linear-gradient(135deg, #fde68a, #f59e0b)', text: '#78350f' },
  { group: '渐变', id: 'lime', label: '青柠', bg: 'linear-gradient(135deg, #bef264, #65a30d)', text: '#ffffff' },
  { group: '渐变', id: 'mint', label: '薄荷', bg: 'linear-gradient(135deg, #6ee7b7, #10b981)', text: '#ffffff' },
  { group: '渐变', id: 'mistwood', label: '森雾', bg: 'linear-gradient(135deg, #a7f3d0, #059669)', text: '#ffffff' },
  { group: '渐变', id: 'tide', label: '碧涛', bg: 'linear-gradient(135deg, #5eead4, #0d9488)', text: '#ffffff' },
  { group: '渐变', id: 'glacier', label: '冰川', bg: 'linear-gradient(135deg, #a5f3fc, #0891b2)', text: '#ffffff' },
  { group: '渐变', id: 'sky', label: '晴空', bg: 'linear-gradient(135deg, #93c5fd, #60a5fa)', text: '#ffffff' },
  { group: '渐变', id: 'mistblue', label: '雾蓝', bg: 'linear-gradient(135deg, #bfdbfe, #3b82f6)', text: '#ffffff' },
  { group: '渐变', id: 'ocean', label: '海洋', bg: 'linear-gradient(135deg, #7dd3fc, #3b82f6)', text: '#ffffff' },
  { group: '渐变', id: 'deepblue', label: '长夜蓝', bg: 'linear-gradient(135deg, #60a5fa, #1e3a8a)', text: '#ffffff' },
  { group: '渐变', id: 'starry', label: '星空', bg: 'linear-gradient(135deg, #818cf8, #312e81)', text: '#ffffff' },
  { group: '渐变', id: 'iris', label: '鸢尾', bg: 'linear-gradient(135deg, #a5b4fc, #6366f1)', text: '#ffffff' },
  { group: '渐变', id: 'lilacgrad', label: '丁香', bg: 'linear-gradient(135deg, #e9d5ff, #9333ea)', text: '#ffffff' },
  { group: '渐变', id: 'wisteria', label: '紫藤', bg: 'linear-gradient(135deg, #c084fc, #7e22ce)', text: '#ffffff' },
  { group: '渐变', id: 'grape', label: '葡萄', bg: 'linear-gradient(135deg, #d8b4fe, #a855f7)', text: '#ffffff' },
  { group: '渐变', id: 'violet', label: '星紫', bg: 'linear-gradient(135deg, #c4b5fd, #8b5cf6)', text: '#ffffff' },
  { group: '渐变', id: 'aurora', label: '极光', bg: 'linear-gradient(135deg, #34d399, #3b82f6 60%, #8b5cf6)', text: '#ffffff' },
  { group: '渐变', id: 'mocha', label: '摩卡', bg: 'linear-gradient(135deg, #d4a373, #7f5539)', text: '#ffffff' },
  { group: '渐变', id: 'milkcoffee', label: '奶咖', bg: 'linear-gradient(135deg, #e7c6a8, #a47148)', text: '#ffffff' },
  { group: '渐变', id: 'silver', label: '银灰', bg: 'linear-gradient(135deg, #cbd5e1, #64748b)', text: '#ffffff' },
  { group: '渐变', id: 'blackcherry', label: '黑樱桃', bg: 'linear-gradient(135deg, #881337, #4c0519)', text: '#fda4af' },
  { group: '渐变', id: 'polarnight', label: '极夜', bg: 'linear-gradient(135deg, #334155, #0f172a)', text: '#e2e8f0' },
  { group: '渐变', id: 'noir', label: '夜金', bg: 'linear-gradient(135deg, #3f3f46, #18181b)', text: '#fcd34d' },
  // ---- 纯色 ----
  { group: '纯色', id: 'white', label: '纯白', bg: '#ffffff', text: '#374151', border: '1px solid #f3d4dc' },
  { group: '纯色', id: 'snow', label: '雾白', bg: '#f8fafc', text: '#475569', border: '1px solid #e2e8f0' },
  { group: '纯色', id: 'cream', label: '奶油', bg: '#fff7ed', text: '#9a3412', border: '1px solid #fed7aa' },
  { group: '纯色', id: 'apricot', label: '杏色', bg: '#fed7aa', text: '#7c2d12' },
  { group: '纯色', id: 'goose', label: '鹅黄', bg: '#fef08a', text: '#713f12' },
  { group: '纯色', id: 'blushsolid', label: '浅粉', bg: '#ffe4e6', text: '#be123c' },
  { group: '纯色', id: 'lilac', label: '浅紫', bg: '#ede9fe', text: '#7c3aed' },
  { group: '纯色', id: 'mauve', label: '灰紫', bg: '#f3e8ff', text: '#6b21a8' },
  { group: '纯色', id: 'babyblue', label: '宝宝蓝', bg: '#dbeafe', text: '#1d4ed8' },
  { group: '纯色', id: 'iceblue', label: '冰蓝', bg: '#cffafe', text: '#155e75' },
  { group: '纯色', id: 'celadon', label: '青瓷', bg: '#99f6e4', text: '#115e59' },
  { group: '纯色', id: 'mintsolid', label: '淡薄荷', bg: '#d1fae5', text: '#065f46' },
  { group: '纯色', id: 'matcha', label: '抹茶', bg: '#d9f99d', text: '#3f6212' },
  { group: '纯色', id: 'honey', label: '蜜糖', bg: '#f59e0b', text: '#ffffff' },
  { group: '纯色', id: 'coralsolid', label: '珊瑚红', bg: '#f87171', text: '#ffffff' },
  { group: '纯色', id: 'wine', label: '酒红', bg: '#9f1239', text: '#ffffff' },
  { group: '纯色', id: 'forest', label: '森绿', bg: '#166534', text: '#ffffff' },
  { group: '纯色', id: 'navy', label: '藏蓝', bg: '#1e3a8a', text: '#ffffff' },
  { group: '纯色', id: 'graphite', label: '石墨', bg: '#374151', text: '#f9fafb' },
  { group: '纯色', id: 'ink', label: '墨黑', bg: '#1f2937', text: '#f9fafb' },
  { group: '纯色', id: 'mochasolid', label: '摩卡棕', bg: '#6f4e37', text: '#fff7ed' },
  // ---- 动态 ----
  { group: '动态', id: 'flow-pink', label: '流光粉', bg: 'linear-gradient(135deg, #fda4af, #f472b6, #fb7185, #fda4af)', text: '#ffffff', anim: 'bubble-flow' },
  { group: '动态', id: 'flow-sunset', label: '流光日落', bg: 'linear-gradient(135deg, #fdba74, #f472b6, #fb923c, #fdba74)', text: '#ffffff', anim: 'bubble-flow' },
  { group: '动态', id: 'flow-rosegold', label: '流光玫金', bg: 'linear-gradient(135deg, #f9a8d4, #f59e0b, #fb7185, #f9a8d4)', text: '#ffffff', anim: 'bubble-flow' },
  { group: '动态', id: 'flow-blue', label: '流光蓝紫', bg: 'linear-gradient(135deg, #93c5fd, #a78bfa, #60a5fa, #93c5fd)', text: '#ffffff', anim: 'bubble-flow' },
  { group: '动态', id: 'flow-mint', label: '流光薄荷', bg: 'linear-gradient(135deg, #6ee7b7, #22d3ee, #10b981, #6ee7b7)', text: '#ffffff', anim: 'bubble-flow' },
  { group: '动态', id: 'aurora-flow', label: '极光流动', bg: 'linear-gradient(135deg, #34d399, #3b82f6, #8b5cf6, #34d399)', text: '#ffffff', anim: 'bubble-flow' },
  { group: '动态', id: 'rainbow', label: '彩虹流动', bg: 'linear-gradient(135deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa)', text: '#ffffff', anim: 'bubble-flow bubble-hue' },
  { group: '动态', id: 'neon-pink', label: '霓虹粉', bg: 'linear-gradient(135deg, #fb7185, #f43f5e)', text: '#ffffff', anim: 'bubble-neon-pink' },
  { group: '动态', id: 'neon-cyan', label: '霓虹青', bg: 'linear-gradient(135deg, #22d3ee, #06b6d4)', text: '#ffffff', anim: 'bubble-neon-cyan' },
  { group: '动态', id: 'neon-violet', label: '霓虹紫', bg: 'linear-gradient(135deg, #a78bfa, #8b5cf6)', text: '#ffffff', anim: 'bubble-neon-violet' },
  { group: '动态', id: 'neon-gold', label: '霓虹金', bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)', text: '#ffffff', anim: 'bubble-neon-gold' },
  { group: '动态', id: 'heartbeat', label: '心跳', bg: 'linear-gradient(135deg, var(--c-primary), var(--c-primary-dark))', text: '#ffffff', anim: 'bubble-beat' },
  { group: '动态', id: 'heartbeat-berry', label: '心跳莓果', bg: 'linear-gradient(135deg, #f472b6, #be185d)', text: '#ffffff', anim: 'bubble-beat' },
]

/** 气泡的内联样式:渐变走 backgroundImage、纯色走 backgroundColor,
 *  这样动态类里的 background-size 才不会被内联 background 简写覆盖 */
export function bubbleCss(b: BubbleStyle): {
  backgroundImage?: string
  backgroundColor?: string
  color: string
  border?: string
  borderRadius?: string
  boxShadow?: string
  textShadow?: string
} {
  const isGradient = b.bg.includes('gradient(')
  return {
    ...(isGradient ? { backgroundImage: b.bg } : { backgroundColor: b.bg }),
    color: b.text,
    ...(b.border ? { border: b.border } : {}),
    ...(b.radius ? { borderRadius: b.radius } : {}),
    ...(b.shadow ? { boxShadow: b.shadow } : {}),
    ...(b.textShadow ? { textShadow: b.textShadow } : {}),
  }
}

const BUBBLE_KEY = 'pref-bubble'

/** 还没选过气泡的一方,用这款干净浅色兜底(浅灰底 + 深色字,配 chat-bubble 柔影) */
export const FALLBACK_BUBBLE: BubbleStyle = {
  group: '默认',
  id: '__fallback',
  label: '默认',
  bg: '#f2f3f5',
  text: '#3a343c',
}

/** 按 id 找气泡样式;找不到用兜底浅色 */
export function bubbleById(id: string | null | undefined): BubbleStyle {
  return BUBBLE_STYLES.find((b) => b.id === id) ?? FALLBACK_BUBBLE
}

export function getBubbleStyle(): BubbleStyle {
  const v = localStorage.getItem(BUBBLE_KEY)
  return BUBBLE_STYLES.find((b) => b.id === v) ?? BUBBLE_STYLES[0]
}

/** 本机是否真的选过气泡(区别于"用默认");用于把旧的本机选择自动同步到 profile */
export const rawBubbleId = () => localStorage.getItem(BUBBLE_KEY)

export function saveBubbleStyle(id: string) {
  localStorage.setItem(BUBBLE_KEY, id)
}

/* ---------- 聊天字体(自己发出的文字,本机生效) ---------- */

export interface BubbleFont {
  id: string
  label: string
  fontFamily?: string
  fontWeight?: number
  fontStyle?: string
  letterSpacing?: string
}

/** 只用系统自带字体栈,零下载零成本;个别设备缺某字体时自动回退近似效果 */
export const BUBBLE_FONTS: BubbleFont[] = [
  { id: 'default', label: '默认' },
  { id: 'serif', label: '宋体雅致', fontFamily: "Georgia, 'Songti SC', 'Noto Serif SC', SimSun, serif" },
  { id: 'kaiti', label: '楷体手写', fontFamily: "'Kaiti SC', KaiTi, STKaiti, 'Noto Serif SC', serif" },
  { id: 'bold', label: '加粗有力', fontWeight: 700 },
  { id: 'italic', label: '微微倾斜', fontStyle: 'italic' },
  { id: 'wide', label: '疏朗开阔', letterSpacing: '0.1em' },
  { id: 'mono', label: '打字机', fontFamily: "ui-monospace, 'SF Mono', 'Courier New', monospace" },
]

const FONT_STYLE_KEY = 'pref-bubble-font'

export function getBubbleFont(): BubbleFont {
  const v = localStorage.getItem(FONT_STYLE_KEY)
  return BUBBLE_FONTS.find((f) => f.id === v) ?? BUBBLE_FONTS[0]
}

export const rawFontId = () => localStorage.getItem(FONT_STYLE_KEY)

export function saveBubbleFont(id: string) {
  localStorage.setItem(FONT_STYLE_KEY, id)
}

/** 按 id 找字体;找不到用默认 */
export function fontById(id: string | null | undefined): BubbleFont {
  return BUBBLE_FONTS.find((f) => f.id === id) ?? BUBBLE_FONTS[0]
}

/* ---------- 对方气泡皮肤(本机偏好,决定"收到的消息"长什么样) ---------- */

export interface RecvSkin {
  id: string
  label: string
  /** 对应 index.css 里的皮肤类(含深色适配) */
  cls: string
}

/** 对方气泡皮肤:告别写死的纯白板,几款精修浅色,跟随主题、深色自适应 */
export const RECV_SKINS: RecvSkin[] = [
  { id: 'macaron', label: '温柔马卡龙', cls: 'recv-macaron' },
  { id: 'clean', label: '清爽灰', cls: 'recv-clean' },
  { id: 'theme', label: '主题浅色', cls: 'recv-theme' },
  { id: 'paper', label: '奶油信纸', cls: 'recv-paper' },
]

const RECV_SKIN_KEY = 'pref-recv-skin'

export function getRecvSkin(): RecvSkin {
  const v = localStorage.getItem(RECV_SKIN_KEY)
  return RECV_SKINS.find((s) => s.id === v) ?? RECV_SKINS[0]
}

export function saveRecvSkin(id: string) {
  localStorage.setItem(RECV_SKIN_KEY, id)
}

/** 字体偏好 → 内联样式 */
export function fontCss(f: BubbleFont): {
  fontFamily?: string
  fontWeight?: number
  fontStyle?: string
  letterSpacing?: string
} {
  return {
    ...(f.fontFamily ? { fontFamily: f.fontFamily } : {}),
    ...(f.fontWeight ? { fontWeight: f.fontWeight } : {}),
    ...(f.fontStyle ? { fontStyle: f.fontStyle } : {}),
    ...(f.letterSpacing ? { letterSpacing: f.letterSpacing } : {}),
  }
}

/* ---------- 聊天背景(预设恋爱主题 / 相册自定义,本机生效) ---------- */

// 内嵌 SVG 爱心暗纹
const HEART_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cpath d='M26 36c-7-5.5-11-9.5-11-13.5A5.5 5.5 0 0126 18a5.5 5.5 0 0111 4.5c0 4-4 8-11 13.5z' fill='%23fb7185' fill-opacity='.08'/%3E%3C/svg%3E")`

export interface ChatBgPreset {
  id: string
  label: string
  /** CSS background 值;空串 = 跟随页面默认背景 */
  css: string
  /** 分组:渐变 / 图案 / 深色 */
  group: string
}

// 内嵌 SVG 暗纹(URL 编码)
const HEART_RAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cpath d='M16 24c-4.6-3.6-7-6.2-7-8.8A3.6 3.6 0 0116 13a3.6 3.6 0 017 2.2c0 2.6-2.4 5.2-7 8.8z' fill='%23fb7185' fill-opacity='.11'/%3E%3Cpath d='M46 52c-3.4-2.7-5.2-4.6-5.2-6.6A2.7 2.7 0 0146 43.5a2.7 2.7 0 015.2 1.9c0 2-1.8 3.9-5.2 6.6z' fill='%23f472b6' fill-opacity='.11'/%3E%3C/svg%3E")`
const SAKURA_PETALS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cellipse cx='14' cy='14' rx='4' ry='7' transform='rotate(35 14 14)' fill='%23f9a8d4' fill-opacity='.18'/%3E%3Cellipse cx='42' cy='40' rx='3.2' ry='5.6' transform='rotate(-25 42 40)' fill='%23fda4af' fill-opacity='.16'/%3E%3C/svg%3E")`

const XO_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='48'%3E%3Ctext x='8' y='22' font-size='13' font-family='monospace' fill='%23fb7185' fill-opacity='.10'%3Exoxo%3C/text%3E%3Ctext x='34' y='42' font-size='13' font-family='monospace' fill='%23f472b6' fill-opacity='.09'%3Exo%3C/text%3E%3C/svg%3E")`
const LOVE_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='86' height='56'%3E%3Ctext x='6' y='24' font-size='12' font-family='sans-serif' fill='%23f43f5e' fill-opacity='.08'%3ELOVE%3C/text%3E%3Ctext x='44' y='48' font-size='12' font-family='sans-serif' fill='%23a855f7' fill-opacity='.07'%3ELOVE%3C/text%3E%3C/svg%3E")`
const MOONSTAR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cpath d='M24 14a8 8 0 100 14 9.5 9.5 0 010-14z' fill='%23fcd34d' fill-opacity='.5'/%3E%3Ccircle cx='56' cy='26' r='1.4' fill='white' fill-opacity='.7'/%3E%3Ccircle cx='66' cy='54' r='1' fill='white' fill-opacity='.55'/%3E%3Ccircle cx='30' cy='60' r='1.2' fill='white' fill-opacity='.6'/%3E%3C/svg%3E")`
const CONFETTI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect x='10' y='12' width='5' height='5' rx='1' transform='rotate(20 12 14)' fill='%23fb7185' fill-opacity='.16'/%3E%3Crect x='50' y='24' width='5' height='5' rx='1' transform='rotate(-15 52 26)' fill='%2360a5fa' fill-opacity='.15'/%3E%3Crect x='26' y='50' width='5' height='5' rx='1' transform='rotate(40 28 52)' fill='%23fbbf24' fill-opacity='.16'/%3E%3Crect x='58' y='58' width='4' height='4' rx='1' transform='rotate(10 60 60)' fill='%2334d399' fill-opacity='.15'/%3E%3C/svg%3E")`
const RINGS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Ccircle cx='18' cy='18' r='7' fill='none' stroke='%23fb7185' stroke-opacity='.12' stroke-width='2'/%3E%3Ccircle cx='48' cy='46' r='5' fill='none' stroke='%23a855f7' stroke-opacity='.10' stroke-width='2'/%3E%3C/svg%3E")`
const TWOHEARTS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='64'%3E%3Cpath d='M34 30c-4-3.1-6-5.3-6-7.5A3 3 0 0134 20a3 3 0 016 2.5c0 2.2-2 4.4-6 7.5z' fill='%23fb7185' fill-opacity='.14'/%3E%3Cpath d='M58 34c-3.4-2.7-5.2-4.6-5.2-6.5A2.6 2.6 0 0158 25.4a2.6 2.6 0 015.2 2.1c0 1.9-1.8 3.8-5.2 6.5z' fill='%23f472b6' fill-opacity='.14'/%3E%3Cpath d='M40 28q6 6 16 2' stroke='%23fda4af' stroke-opacity='.25' stroke-width='1.2' fill='none' stroke-dasharray='3 3'/%3E%3C/svg%3E")`
const PLUS_STARS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cpath d='M14 10v8M10 14h8' stroke='%23f472b6' stroke-opacity='.14' stroke-width='1.6' stroke-linecap='round'/%3E%3Cpath d='M42 38v6M39 41h6' stroke='%2360a5fa' stroke-opacity='.13' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E")`
const ECG_LINE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='48'%3E%3Cpath d='M0 24h28l6-12 8 24 6-12h12l6-8 8 16 6-8h40' fill='none' stroke='%23fb7185' stroke-opacity='.13' stroke-width='1.6'/%3E%3C/svg%3E")`

// 臻景所需的精绘 SVG(花瓣/星点/love 涂鸦/海鸥)
const SAKURA_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cg fill='%23f9a8d4' fill-opacity='.42'%3E%3Cellipse cx='14' cy='16' rx='4' ry='7' transform='rotate(32 14 16)'/%3E%3Cellipse cx='46' cy='42' rx='3' ry='5.5' transform='rotate(-22 46 42)'/%3E%3Cellipse cx='30' cy='54' rx='2.6' ry='4.6' transform='rotate(12 30 54)'/%3E%3C/g%3E%3C/svg%3E")`
const STARS_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cg fill='white'%3E%3Ccircle cx='10' cy='12' r='1.2' opacity='.9'/%3E%3Ccircle cx='44' cy='30' r='.8' opacity='.6'/%3E%3Ccircle cx='72' cy='16' r='1.4' opacity='.85'/%3E%3Ccircle cx='24' cy='62' r='1' opacity='.7'/%3E%3Ccircle cx='58' cy='72' r='1.2' opacity='.6'/%3E%3Ccircle cx='82' cy='52' r='.9' opacity='.8'/%3E%3C/g%3E%3C/svg%3E")`
const LOVE_DOODLE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='100'%3E%3Cpath d='M20 28c-4-5-12-3-12 4 0 6 12 12 12 12s12-6 12-12c0-7-8-9-12-4z' fill='none' stroke='%23fb7185' stroke-opacity='.45' stroke-width='1.4'/%3E%3Cpath d='M118 74c-3-4-9-2-9 3 0 5 9 9 9 9s9-4 9-9c0-5-6-7-9-3z' fill='none' stroke='%23a78bfa' stroke-opacity='.4' stroke-width='1.4'/%3E%3Ctext x='52' y='44' font-family='cursive' font-size='22' fill='%23f9a8d4' fill-opacity='.5'%3Elove%3C/text%3E%3Ctext x='30' y='90' font-family='cursive' font-size='17' fill='%23fda4af' fill-opacity='.42'%3Eyou%3C/text%3E%3C/svg%3E")`
const GULLS_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='70'%3E%3Cg fill='none' stroke='%23475569' stroke-opacity='.45' stroke-width='1.6' stroke-linecap='round'%3E%3Cpath d='M14 18q6-6 12 0 6-6 12 0'/%3E%3Cpath d='M70 40q5-5 10 0 5-5 10 0'/%3E%3C/g%3E%3C/svg%3E")`

// ---- M 新增:更多缤纷图案(URL 编码的内联 SVG,CSP 安全、可离线) ----
const POLKA_DOTS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='10' cy='10' r='2.5' fill='%23fb7185' fill-opacity='.13'/%3E%3Ccircle cx='30' cy='30' r='2.5' fill='%23f472b6' fill-opacity='.11'/%3E%3C/svg%3E")`
const TINY_STARS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M14 6l1.4 4 4 1.4-4 1.4L14 17l-1.4-4-4-1.4 4-1.4z' fill='%23fbbf24' fill-opacity='.18'/%3E%3Cpath d='M44 36l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z' fill='%23a78bfa' fill-opacity='.15'/%3E%3C/svg%3E")`
const SOFT_CLOUDS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='60'%3E%3Cg fill='%2360a5fa' fill-opacity='.09'%3E%3Cellipse cx='24' cy='24' rx='15' ry='7'/%3E%3Cellipse cx='15' cy='26' rx='8' ry='5'/%3E%3Cellipse cx='35' cy='26' rx='9' ry='5'/%3E%3C/g%3E%3C/svg%3E")`
const BUBBLES_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cg fill='none' stroke='%2322d3ee' stroke-opacity='.18'%3E%3Ccircle cx='16' cy='18' r='6'/%3E%3Ccircle cx='46' cy='42' r='9'/%3E%3Ccircle cx='40' cy='14' r='3'/%3E%3C/g%3E%3C/svg%3E")`
const WAVE_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='24'%3E%3Cpath d='M0 12q10-8 20 0t20 0 20 0 20 0' fill='none' stroke='%2338bdf8' stroke-opacity='.16' stroke-width='2'/%3E%3C/svg%3E")`
const PAW_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Cg fill='%23f59e0b' fill-opacity='.13'%3E%3Cellipse cx='16' cy='22' rx='3.4' ry='4.2'/%3E%3Ccircle cx='10.5' cy='15' r='1.7'/%3E%3Ccircle cx='16' cy='13' r='1.7'/%3E%3Ccircle cx='21.5' cy='15' r='1.7'/%3E%3C/g%3E%3C/svg%3E")`
const MUSIC_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cg fill='%23a855f7' fill-opacity='.13'%3E%3Ccircle cx='12' cy='40' r='3.5'/%3E%3Crect x='14.6' y='18' width='1.8' height='22'/%3E%3Ccircle cx='40' cy='30' r='3'/%3E%3Crect x='42.2' y='12' width='1.6' height='18'/%3E%3C/g%3E%3C/svg%3E")`
const LEAF_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cg fill='%2334d399' fill-opacity='.13'%3E%3Cpath d='M14 24q-8-8 0-16 8 8 0 16z'/%3E%3Cpath d='M44 52q-6-6 0-12 6 6 0 12z'/%3E%3C/g%3E%3C/svg%3E")`

export const CHAT_BGS: ChatBgPreset[] = [
  // ---- 缤纷渐变(清新活泼) ----
  { group: '缤纷', id: 'mint-sky', label: '薄荷晴空', css: 'linear-gradient(180deg, #d1fae5, #e0f2fe)' },
  { group: '缤纷', id: 'peach-lilac', label: '蜜桃丁香', css: 'linear-gradient(180deg, #ffe4e6, #ede9fe)' },
  { group: '缤纷', id: 'honey-dusk', label: '日暮蜜糖', css: 'linear-gradient(180deg, #fed7aa, #fecdd3)' },
  { group: '缤纷', id: 'grape-soda', label: '葡萄冰沙', css: 'linear-gradient(180deg, #e9d5ff, #c7d2fe)' },
  { group: '缤纷', id: 'green-soda', label: '青提苏打', css: 'linear-gradient(180deg, #ecfccb, #a7f3d0)' },
  { group: '缤纷', id: 'cloud-sea', label: '云海', css: 'linear-gradient(180deg, #e0f2fe, #f5f3ff 55%, #fff1f2)' },
  { group: '缤纷', id: 'aurora-soft', label: '柔光极光', css: 'linear-gradient(135deg, #a7f3d0, #bfdbfe 50%, #ddd6fe)' },
  // ---- 图案(新增) ----
  { group: '图案', id: 'polka', label: '波点', css: `${POLKA_DOTS} 0 0 / 40px repeat, #fff5f8` },
  { group: '图案', id: 'tiny-stars', label: '星星点点', css: `${TINY_STARS} 0 0 / 60px repeat, #fffdf6` },
  { group: '图案', id: 'clouds', label: '云朵', css: `${SOFT_CLOUDS} 0 0 / 90px repeat, #f0f9ff` },
  { group: '图案', id: 'bubbles', label: '气泡', css: `${BUBBLES_BG} 0 0 / 64px repeat, #ecfeff` },
  { group: '图案', id: 'waves', label: '碧波', css: `${WAVE_BG} 0 0 / 80px repeat, #f0f9ff` },
  { group: '图案', id: 'paws', label: '小爪印', css: `${PAW_BG} 0 0 / 56px repeat, #fffbeb` },
  { group: '图案', id: 'music', label: '音符', css: `${MUSIC_BG} 0 0 / 60px repeat, #faf5ff` },
  { group: '图案', id: 'leaves', label: '绿叶', css: `${LEAF_BG} 0 0 / 64px repeat, #f0fdf4` },
  // ---- 深色(新增) ----
  { group: '深色', id: 'starry-night', label: '星河夜', css: `${STARS_BG} 0 0 / 90px repeat, linear-gradient(180deg, #1e1b4b, #0f172a)` },
  { group: '深色', id: 'neon-night', label: '霓虹夜', css: 'linear-gradient(180deg, #18181b, #312e81)' },
  { group: '深色', id: 'midnight-blue', label: '午夜蓝', css: 'linear-gradient(180deg, #0f172a, #1e293b)' },
  // ---- 臻景:高清场景(多层渐变 + 精绘 SVG) ----
  { group: '臻景', id: 'lux-sunset', label: '落日海滩', css: 'radial-gradient(circle at 50% 56%, #fff7d6 0 3.5%, transparent 5%), radial-gradient(circle at 50% 56%, rgba(255,228,160,.9), transparent 26%), linear-gradient(180deg, transparent 64%, rgba(255,255,255,.16) 65%, transparent 67%, rgba(255,255,255,.1) 73%, transparent 75%), linear-gradient(180deg, #ffb27a, #ff7e8a 34%, #d8537e 56%, #6d3b8e 100%)' },
  { group: '臻景', id: 'lux-sakura', label: '樱花飞舞', css: `${SAKURA_BG} 0 0 / 64px repeat, linear-gradient(180deg, #ffe3ef, #f3e1f7 50%, #dde7fb)` },
  { group: '臻景', id: 'lux-galaxy', label: '星河入梦', css: `${STARS_BG} 0 0 / 90px repeat, radial-gradient(circle at 78% 16%, #fdf6c8 0 12px, rgba(253,246,200,.3) 14px, transparent 22px), linear-gradient(180deg, #1b1247, #2e1d57 55%, #0e1030)` },
  { group: '臻景', id: 'lux-love', label: '喜欢你', css: `${LOVE_DOODLE} 0 0 / 150px repeat, linear-gradient(180deg, #1a141d, #241a28)` },
  { group: '臻景', id: 'lux-rain', label: '烟雨', css: 'repeating-linear-gradient(102deg, rgba(255,255,255,.07) 0 1px, transparent 1px 8px), linear-gradient(180deg, #33414f, #1d2730)' },
  { group: '臻景', id: 'lux-seaside', label: '晴海白鸥', css: `${GULLS_BG} 0 14px / 130px repeat, radial-gradient(60px 30px at 24% 26%, rgba(255,255,255,.95), transparent 70%), radial-gradient(52px 26px at 62% 18%, rgba(255,255,255,.85), transparent 70%), linear-gradient(180deg, #bfe8ff, #7cc0ec 58%, #dff3ff)` },
  // ---- 渐变 ----
  { group: '渐变', id: 'default', label: '默认', css: '' },
  { group: '渐变', id: 'blush', label: '绯雾', css: 'linear-gradient(165deg, #fff1f2 0%, #ffe4e6 45%, #fce7f3 100%)' },
  { group: '渐变', id: 'dusk', label: '黄昏', css: 'linear-gradient(165deg, #fde6e9 0%, #e8d5f5 60%, #d6e0fb 100%)' },
  { group: '渐变', id: 'coralsunset', label: '珊瑚日落', css: 'linear-gradient(170deg, #ffe4e6, #fecaca 55%, #fed7aa)' },
  { group: '渐变', id: 'rosegoldbg', label: '玫瑰金', css: 'linear-gradient(165deg, #fff1f2, #fde8d7 60%, #fde68a)' },
  { group: '渐变', id: 'peachsoda', label: '蜜桃汽水', css: 'linear-gradient(180deg, #fff1f2, #ffe4e6 50%, #fed7aa)' },
  { group: '渐变', id: 'grapefruit', label: '西柚', css: 'linear-gradient(170deg, #fff1f2, #ffedd5)' },
  { group: '渐变', id: 'cream', label: '奶油', css: 'linear-gradient(170deg, #fffbeb, #ffedd5)' },
  { group: '渐变', id: 'almond', label: '杏仁', css: 'linear-gradient(170deg, #fff7ed, #fed7aa)' },
  { group: '渐变', id: 'lemonade', label: '柠檬水', css: 'linear-gradient(170deg, #fefce8, #fef9c3)' },
  { group: '渐变', id: 'sprout', label: '春芽', css: 'linear-gradient(170deg, #f7fee7, #ecfccb)' },
  { group: '渐变', id: 'forestmorning', label: '森林晨光', css: 'linear-gradient(170deg, #f0fdf4, #dcfce7)' },
  { group: '渐变', id: 'melon', label: '蜜瓜', css: 'linear-gradient(170deg, #f0fdfa, #ccfbf1)' },
  { group: '渐变', id: 'mintshake', label: '薄荷奶昔', css: 'linear-gradient(165deg, #ecfdf5, #d1fae5)' },
  { group: '渐变', id: 'aqua', label: '青空', css: 'linear-gradient(170deg, #ecfeff, #a5f3fc)' },
  { group: '渐变', id: 'skybg', label: '天空', css: 'linear-gradient(170deg, #e0f2fe, #bae6fd)' },
  { group: '渐变', id: 'seasalt', label: '海盐', css: 'linear-gradient(165deg, #ecfeff, #dbeafe)' },
  { group: '渐变', id: 'morningmist', label: '晨雾蓝', css: 'linear-gradient(170deg, #eff6ff, #e0e7ff)' },
  { group: '渐变', id: 'irisbg', label: '鸢尾紫', css: 'linear-gradient(170deg, #eef2ff, #e0e7ff 60%, #ede9fe)' },
  { group: '渐变', id: 'grapesoda', label: '葡萄苏打', css: 'linear-gradient(170deg, #faf5ff, #f3e8ff)' },
  { group: '渐变', id: 'lavender', label: '薄暮紫', css: 'linear-gradient(165deg, #f5f3ff, #ede9fe 60%, #fce7f3)' },
  { group: '渐变', id: 'morandi', label: '灰粉莫兰迪', css: 'linear-gradient(165deg, #f5f0f0, #eadfe1)' },
  { group: '渐变', id: 'firstsnow', label: '初雪', css: 'linear-gradient(170deg, #fafafa, #f1f5f9)' },
  { group: '渐变', id: 'foggrey', label: '雾灰', css: 'linear-gradient(170deg, #f9fafb, #f3f4f6)' },
  { group: '渐变', id: 'milktea', label: '奶茶', css: 'linear-gradient(170deg, #faf4ec, #f0e2d0)' },
  // ---- 图案 ----
  { group: '图案', id: 'hearts', label: '爱心暗纹', css: `${HEART_PATTERN}, linear-gradient(180deg, #fff8f7, #fff1f2)` },
  { group: '图案', id: 'heartrain', label: '爱心雨', css: `${HEART_RAIN}, linear-gradient(180deg, #fff8f7, #ffeef0)` },
  { group: '图案', id: 'twohearts', label: '双心相连', css: `${TWOHEARTS}, linear-gradient(180deg, #fff8f7, #fdf2f8)` },
  { group: '图案', id: 'sakurabg', label: '樱花瓣', css: `${SAKURA_PETALS}, linear-gradient(180deg, #fff8f7, #fdf2f8)` },
  { group: '图案', id: 'xoxo', label: 'XOXO', css: `${XO_PATTERN}, linear-gradient(180deg, #fff8f7, #fff1f2)` },
  { group: '图案', id: 'lovetext', label: 'LOVE 字纹', css: `${LOVE_PATTERN}, linear-gradient(180deg, #fffafc, #fdf4ff)` },
  { group: '图案', id: 'ecg', label: '心动心电图', css: `${ECG_LINE} 0 0 / 120px 48px, linear-gradient(180deg, #fff8f7, #fff1f2)` },
  { group: '图案', id: 'confetti', label: '彩纸屑', css: `${CONFETTI}, linear-gradient(180deg, #fffefb, #fff8f7)` },
  { group: '图案', id: 'rings', label: '圆环', css: `${RINGS}, linear-gradient(180deg, #fffafa, #fdf2f8)` },
  { group: '图案', id: 'plusstars', label: '小星十字', css: `${PLUS_STARS}, linear-gradient(180deg, #fefeff, #f5f7ff)` },
  { group: '图案', id: 'dots', label: '波点', css: 'radial-gradient(circle, rgba(251,113,133,.14) 1.5px, transparent 2px) 0 0 / 22px 22px, linear-gradient(180deg, #fff8f7, #fff1f2)' },
  { group: '图案', id: 'bluedots', label: '蓝波点', css: 'radial-gradient(circle, rgba(96,165,250,.15) 1.5px, transparent 2px) 0 0 / 22px 22px, linear-gradient(180deg, #fbfdff, #eff6ff)' },
  { group: '图案', id: 'golddust', label: '碎金', css: 'radial-gradient(circle, rgba(245,158,11,.13) 1.2px, transparent 1.8px) 0 0 / 26px 26px, linear-gradient(175deg, #fffbeb, #fff7ed)' },
  { group: '图案', id: 'stripes', label: '细斜纹', css: 'repeating-linear-gradient(45deg, rgba(244,63,94,.045) 0 2px, transparent 2px 10px), linear-gradient(#fffafa, #fff5f6)' },
  { group: '图案', id: 'grid', label: '信笺方格', css: 'linear-gradient(rgba(244,63,94,.05) 1px, transparent 1px) 0 0 / 100% 24px, linear-gradient(90deg, rgba(244,63,94,.05) 1px, transparent 1px) 0 0 / 24px 100%, linear-gradient(#fffafa, #fffafa)' },
  { group: '图案', id: 'ruled', label: '信纸横线', css: 'linear-gradient(rgba(96,165,250,.10) 1px, transparent 1px) 0 0 / 100% 28px, linear-gradient(#fffefc, #fffefc)' },
  // ---- 深色 ----
  { group: '深色', id: 'night', label: '星夜', css: 'radial-gradient(circle, rgba(255,255,255,.16) 1px, transparent 1.5px) 0 0 / 26px 26px, linear-gradient(180deg, #2b2150, #1a1432)' },
  { group: '深色', id: 'moonstar', label: '月与星', css: `${MOONSTAR} 0 0 / 80px 80px, linear-gradient(180deg, #1e1b4b, #0f172a)` },
  { group: '深色', id: 'deepsea', label: '深海', css: 'radial-gradient(circle at 50% 120%, #1e3a8a 0%, #0f172a 65%)' },
  { group: '深色', id: 'midnight', label: '子夜蓝', css: 'linear-gradient(180deg, #0b1220, #1e293b)' },
  { group: '深色', id: 'auroranight', label: '极光夜', css: 'linear-gradient(180deg, #0f172a, #312e81 55%, #0f172a)' },
  { group: '深色', id: 'plum', label: '暮紫', css: 'linear-gradient(180deg, #3b0764, #1e1b4b)' },
  { group: '深色', id: 'darkviolet', label: '暗紫罗兰', css: 'linear-gradient(180deg, #2e1065, #4c1d95)' },
  { group: '深色', id: 'darkrose', label: '暗玫瑰', css: 'linear-gradient(180deg, #3f0d1e, #180510)' },
  { group: '深色', id: 'winenight', label: '酒红夜', css: 'linear-gradient(180deg, #450a0a, #7f1d1d)' },
  { group: '深色', id: 'forestnight', label: '墨绿夜', css: 'linear-gradient(180deg, #022c22, #064e3b)' },
  { group: '深色', id: 'spacegrey', label: '深空灰', css: 'linear-gradient(180deg, #18181b, #27272a)' },
  { group: '深色', id: 'ember', label: '炭烬碎金', css: 'radial-gradient(circle, rgba(251,191,36,.12) 1px, transparent 1.6px) 0 0 / 30px 30px, linear-gradient(180deg, #27272a, #18181b)' },
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

export function applyTheme(id: ThemeId, animate = false) {
  if (animate) flashThemeTransition()
  // 默认粉色直接走 :root 变量,其他主题通过 data-theme 覆盖
  if (id === 'rose') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', id)
  localStorage.setItem(THEME_KEY, id)
  syncThemeColor()
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
