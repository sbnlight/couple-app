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
  /** 顶饰/尾巴的颜色;不填则用气泡主色 */
  accent?: string
}

export const BUBBLE_STYLES: BubbleStyle[] = [
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
  { group: '少女装饰', id: 'deco-moon', label: '月夜星辰', bg: 'linear-gradient(135deg, #1e1b4b, #312e81)', text: '#e0e7ff', deco: [{ emoji: '🌙', pos: 'tr', size: 17, rot: 15, anim: 'swing' }, { emoji: '⭐', pos: 'bl', size: 12, anim: 'twinkle' }] },
  // ---- 异形边框 ----
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
  { group: '氛围质感', id: 'tex-gingham', label: '格子布', bg: 'repeating-linear-gradient(0deg, rgba(244,63,94,.12) 0 8px, transparent 8px 16px), repeating-linear-gradient(90deg, rgba(244,63,94,.12) 0 8px, transparent 8px 16px), #ffffff', text: '#be123c', border: '1.5px solid #fda4af' },
  { group: '氛围质感', id: 'tex-letter', label: '信纸', bg: 'linear-gradient(rgba(96,165,250,.18) 1px, transparent 1px) 0 6px / 100% 22px, #fffef6', text: '#44403c', border: '1px solid #e7e5e4' },
  { group: '氛围质感', id: 'tex-blackgold', label: '黑金奢华', bg: 'linear-gradient(135deg, #1c1917, #0c0a09)', text: '#f5d061', border: '1px solid #d4af37' },
  { group: '氛围质感', id: 'tex-denim', label: '牛仔布', bg: 'repeating-linear-gradient(45deg, #4a6da7 0 4px, #41619c 4px 8px)', text: '#eff6ff', shadow: 'inset 0 0 0 2px #34518a', radius: '12px' },
  { group: '氛围质感', id: 'tex-plush', label: '毛绒绒', bg: 'radial-gradient(circle, rgba(255,255,255,.5) 1.5px, transparent 2px) 0 0 / 8px 8px, #fda4af', text: '#881337', radius: '24px' },
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

export function getBubbleStyle(): BubbleStyle {
  const v = localStorage.getItem(BUBBLE_KEY)
  return BUBBLE_STYLES.find((b) => b.id === v) ?? BUBBLE_STYLES[0]
}

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

export function saveBubbleFont(id: string) {
  localStorage.setItem(FONT_STYLE_KEY, id)
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

export const CHAT_BGS: ChatBgPreset[] = [
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
