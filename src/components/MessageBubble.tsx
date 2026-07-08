import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { getSignedUrl, clearSignedUrl } from '../lib/storage'
import { BUBBLE_FONTS, BUBBLE_STYLES, bubbleCss, fontCss } from '../lib/prefs'
import type { BubbleDeco, BubbleFont, BubbleStyle } from '../lib/prefs'

/** 挂件的四角定位 */
const DECO_POS: Record<BubbleDeco['pos'], CSSProperties> = {
  tl: { top: -11, left: -7 },
  tr: { top: -11, right: -7 },
  bl: { bottom: -9, left: -7 },
  br: { bottom: -9, right: -7 },
}

/** SVG 手绘顶饰:气泡「长出」耳朵/角/皇冠等(纯矢量,非 emoji) */
function Topper({ type, color }: { type: NonNullable<BubbleStyle['topper']>; color: string }) {
  const place = (node: ReactNode, style: CSSProperties, key: string) => (
    <span key={key} className="pointer-events-none absolute" style={style}>
      {node}
    </span>
  )
  // 两侧耳朵/角:左上 + 右上(右侧水平镜像)
  const pair = (node: ReactNode, topPx: number) => [
    place(node, { left: 6, top: topPx }, 'l'),
    place(node, { right: 6, top: topPx, transform: 'scaleX(-1)' }, 'r'),
  ]
  const center = (node: ReactNode, topPx: number) =>
    place(node, { left: '50%', top: topPx, transform: 'translateX(-50%)' }, 'c')

  switch (type) {
    case 'cat':
      return <>{pair(<svg width="18" height="16"><path d="M2 16 L5 1 L17 14 Z" fill={color} /></svg>, -9)}</>
    case 'fox':
      return <>{pair(<svg width="15" height="18"><path d="M2 18 L4 1 L14 16 Z" fill={color} /><path d="M5 15 L6 6 L11 14 Z" fill="#ffffff" opacity="0.85" /></svg>, -11)}</>
    case 'bear':
      return <>{pair(<svg width="16" height="14"><circle cx="8" cy="8" r="7" fill={color} /></svg>, -7)}</>
    case 'panda':
      return <>{pair(<svg width="16" height="14"><circle cx="8" cy="8" r="7" fill={color} /></svg>, -7)}</>
    case 'bunny':
      return (
        <>
          {place(<svg width="12" height="24"><ellipse cx="6" cy="12" rx="4.5" ry="11" fill={color} /></svg>, { left: 8, top: -18, transform: 'rotate(-12deg)' }, 'l')}
          {place(<svg width="12" height="24"><ellipse cx="6" cy="12" rx="4.5" ry="11" fill={color} /></svg>, { right: 8, top: -18, transform: 'rotate(12deg)' }, 'r')}
        </>
      )
    case 'devil':
      return <>{pair(<svg width="12" height="16"><path d="M3 16 Q2 5 10 1 Q6 7 9 16 Z" fill={color} /></svg>, -10)}</>
    case 'crown':
      return <>{center(<svg width="42" height="18"><path d="M2 17 L2 6 L12 12 L21 1 L30 12 L40 6 L40 17 Z" fill={color} /></svg>, -12)}</>
    case 'antenna':
      return (
        <>
          {center(
            <svg width="32" height="16">
              <path d="M10 16 Q8 6 5 3" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
              <circle cx="5" cy="3" r="2.5" fill={color} />
              <path d="M22 16 Q24 6 27 3" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
              <circle cx="27" cy="3" r="2.5" fill={color} />
            </svg>,
            -12,
          )}
        </>
      )
    case 'sprout':
      return (
        <>
          {center(
            <svg width="20" height="16">
              <path d="M10 16 L10 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
              <path d="M10 9 Q3 8 3 2 Q9 2 10 9 Z" fill={color} />
              <path d="M10 11 Q17 10 17 4 Q11 4 10 11 Z" fill={color} />
            </svg>,
            -12,
          )}
        </>
      )
    case 'halo':
      return <>{center(<svg width="34" height="14"><ellipse cx="17" cy="8" rx="13" ry="4.5" fill="none" stroke={color} strokeWidth="3" /></svg>, -13)}</>
    case 'wings': {
      // 双层羽毛翼,从两侧上方探出
      const wing = (
        <svg width="30" height="22" viewBox="0 0 30 22">
          <path d="M29 21 Q5 20 1 2 Q13 10 29 21 Z" fill={color} />
          <path d="M29 21 Q13 16 9 6 Q17 13 29 21 Z" fill={color} opacity="0.65" />
        </svg>
      )
      return [
        place(wing, { left: -8, top: -12 }, 'wl'),
        place(wing, { right: -8, top: -12, transform: 'scaleX(-1)' }, 'wr'),
      ]
    }
    default:
      return null
  }
}

/* ---------- 原创吉祥物贴纸(QQ「探头」既视感):纯内联 SVG,可离线、无版权 ---------- */

/** 吉祥物挂角定位:比 emoji 挂件更大、更外探,像贴纸叠在气泡角上 */
const MASCOT_POS: Record<NonNullable<BubbleStyle['mascotPos']>, CSSProperties> = {
  tl: { top: -20, left: -16 },
  tr: { top: -20, right: -16 },
  bl: { bottom: -16, left: -16 },
  br: { bottom: -16, right: -16 },
}

/** 一组原创卡通角色(48×48 viewBox),圆润可爱、脸颊带腮红,统一风格 */
const MASCOTS: Record<string, ReactNode> = {
  penguin: (
    <svg viewBox="0 0 48 48" width="46" height="46">
      <ellipse cx="24" cy="26" rx="15" ry="18" fill="#2f3a4a" />
      <ellipse cx="24" cy="29" rx="9.5" ry="13" fill="#fbfcff" />
      <ellipse cx="12" cy="41" rx="4.5" ry="2.4" fill="#f6a723" />
      <ellipse cx="36" cy="41" rx="4.5" ry="2.4" fill="#f6a723" />
      <circle cx="18.5" cy="20" r="3.4" fill="#fff" />
      <circle cx="19" cy="20.4" r="1.7" fill="#2b3440" />
      <circle cx="29.5" cy="20" r="3.4" fill="#fff" />
      <circle cx="29" cy="20.4" r="1.7" fill="#2b3440" />
      <path d="M21.5 24 h5 l-2.5 3.2 z" fill="#f6a723" />
      <circle cx="14.5" cy="27" r="2.2" fill="#f9c1d1" opacity="0.8" />
      <circle cx="33.5" cy="27" r="2.2" fill="#f9c1d1" opacity="0.8" />
    </svg>
  ),
  bear: (
    <svg viewBox="0 0 48 48" width="46" height="46">
      <circle cx="14" cy="14" r="6" fill="#c98b5e" />
      <circle cx="34" cy="14" r="6" fill="#c98b5e" />
      <circle cx="14" cy="14" r="3" fill="#e6b98f" />
      <circle cx="34" cy="14" r="3" fill="#e6b98f" />
      <circle cx="24" cy="26" r="16" fill="#c98b5e" />
      <ellipse cx="24" cy="30" rx="9" ry="7.5" fill="#f0dcc4" />
      <circle cx="18" cy="23" r="2.1" fill="#4a3527" />
      <circle cx="30" cy="23" r="2.1" fill="#4a3527" />
      <ellipse cx="24" cy="28" rx="2.4" ry="1.8" fill="#4a3527" />
      <path d="M24 29.5 v2.5 M24 32 q-3 2 -5 0 M24 32 q3 2 5 0" stroke="#4a3527" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="28" r="2" fill="#f4a9b8" opacity="0.7" />
      <circle cx="32" cy="28" r="2" fill="#f4a9b8" opacity="0.7" />
    </svg>
  ),
  bunny: (
    <svg viewBox="0 0 48 48" width="46" height="46">
      <ellipse cx="17" cy="10" rx="4" ry="10" fill="#fff" stroke="#f0d0da" strokeWidth="0.8" />
      <ellipse cx="31" cy="10" rx="4" ry="10" fill="#fff" stroke="#f0d0da" strokeWidth="0.8" />
      <ellipse cx="17" cy="11" rx="1.8" ry="6" fill="#f9b8c8" />
      <ellipse cx="31" cy="11" rx="1.8" ry="6" fill="#f9b8c8" />
      <circle cx="24" cy="29" r="15" fill="#fff" stroke="#f2e2e8" strokeWidth="0.6" />
      <circle cx="18.5" cy="27" r="2" fill="#5b4a52" />
      <circle cx="29.5" cy="27" r="2" fill="#5b4a52" />
      <path d="M22 31 q2 1.6 4 0" stroke="#e06a86" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="30.5" rx="1.5" ry="1" fill="#f9b8c8" />
      <circle cx="16.5" cy="31" r="2.2" fill="#fbccd8" />
      <circle cx="31.5" cy="31" r="2.2" fill="#fbccd8" />
    </svg>
  ),
  cat: (
    <svg viewBox="0 0 48 48" width="46" height="46">
      <path d="M11 8 L16 20 L22 15 Z" fill="#f2a154" />
      <path d="M37 8 L32 20 L26 15 Z" fill="#f2a154" />
      <circle cx="24" cy="27" r="16" fill="#f2a154" />
      <path d="M13 22 h7 M28 22 h7 M12 27 h6 M30 27 h6" stroke="#dd8836" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="18" cy="25" r="2.2" fill="#3a2b20" />
      <circle cx="30" cy="25" r="2.2" fill="#3a2b20" />
      <path d="M22.5 29 l1.5 1.5 l1.5 -1.5 z" fill="#e06a86" />
      <path d="M24 30.5 v2 M24 32 q-2.5 1.5 -4 0 M24 32 q2.5 1.5 4 0" stroke="#3a2b20" strokeWidth="1" fill="none" strokeLinecap="round" />
      <circle cx="15.5" cy="30" r="2" fill="#f4a9b8" opacity="0.7" />
      <circle cx="32.5" cy="30" r="2" fill="#f4a9b8" opacity="0.7" />
    </svg>
  ),
  shiba: (
    <svg viewBox="0 0 48 48" width="46" height="46">
      <path d="M10 10 L16 22 L21 16 Z" fill="#e6a866" />
      <path d="M38 10 L32 22 L27 16 Z" fill="#e6a866" />
      <circle cx="24" cy="27" r="16" fill="#e6a866" />
      <path d="M24 20 q-9 0 -11 9 q6 4 11 4 q5 0 11 -4 q-2 -9 -11 -9z" fill="#fbe6d2" />
      <circle cx="18" cy="24" r="2.1" fill="#3a2b20" />
      <circle cx="30" cy="24" r="2.1" fill="#3a2b20" />
      <ellipse cx="24" cy="29" rx="2" ry="1.5" fill="#3a2b20" />
      <path d="M24 30.5 q-2 2 -4 1 M24 30.5 q2 2 4 1" stroke="#3a2b20" strokeWidth="1" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="29" r="1.8" fill="#f4a9b8" opacity="0.7" />
      <circle cx="32" cy="29" r="1.8" fill="#f4a9b8" opacity="0.7" />
    </svg>
  ),
  chick: (
    <svg viewBox="0 0 48 48" width="44" height="44">
      <circle cx="24" cy="26" r="15" fill="#ffd93b" />
      <path d="M24 12 q1 -4 3 -3 q-1 3 -3 3z" fill="#ffb703" />
      <circle cx="19" cy="24" r="2" fill="#3a2b20" />
      <circle cx="29" cy="24" r="2" fill="#3a2b20" />
      <path d="M21.5 28 h5 l-2.5 3 z" fill="#ff9505" />
      <circle cx="16" cy="29" r="2" fill="#ffb0b0" opacity="0.7" />
      <circle cx="32" cy="29" r="2" fill="#ffb0b0" opacity="0.7" />
      <path d="M12 34 q3 2 6 1 M36 34 q-3 2 -6 1" stroke="#ffb703" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  ),
  panda: (
    <svg viewBox="0 0 48 48" width="46" height="46">
      <circle cx="13" cy="13" r="5.5" fill="#2b2b2b" />
      <circle cx="35" cy="13" r="5.5" fill="#2b2b2b" />
      <circle cx="24" cy="27" r="16" fill="#fff" stroke="#ececec" strokeWidth="0.6" />
      <ellipse cx="17" cy="25" rx="4" ry="5" fill="#2b2b2b" transform="rotate(-15 17 25)" />
      <ellipse cx="31" cy="25" rx="4" ry="5" fill="#2b2b2b" transform="rotate(15 31 25)" />
      <circle cx="17.5" cy="25.5" r="1.6" fill="#fff" />
      <circle cx="30.5" cy="25.5" r="1.6" fill="#fff" />
      <ellipse cx="24" cy="30" rx="2" ry="1.5" fill="#2b2b2b" />
      <path d="M24 31 v1.5 M24 32.5 q-2 1.5 -3.5 0 M24 32.5 q2 1.5 3.5 0" stroke="#2b2b2b" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  ),
  frog: (
    <svg viewBox="0 0 48 48" width="46" height="46">
      <circle cx="15" cy="15" r="6" fill="#7cc576" />
      <circle cx="33" cy="15" r="6" fill="#7cc576" />
      <circle cx="15" cy="15" r="3" fill="#fff" />
      <circle cx="33" cy="15" r="3" fill="#fff" />
      <circle cx="15" cy="15.5" r="1.5" fill="#2b2b2b" />
      <circle cx="33" cy="15.5" r="1.5" fill="#2b2b2b" />
      <circle cx="24" cy="29" r="15" fill="#7cc576" />
      <ellipse cx="24" cy="33" rx="9" ry="6" fill="#c9e8bf" />
      <path d="M18 31 q6 4 12 0" stroke="#3f7a3a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="17" cy="31" r="2" fill="#f4a9b8" opacity="0.6" />
      <circle cx="31" cy="31" r="2" fill="#f4a9b8" opacity="0.6" />
    </svg>
  ),
  dino: (
    <svg viewBox="0 0 48 48" width="46" height="46">
      <path d="M14 16 l3 -5 l3 5 M20 13 l3 -5 l3 5 M26 15 l3 -5 l3 5" fill="#59b36a" />
      <ellipse cx="24" cy="28" rx="15" ry="15" fill="#6cc47d" />
      <ellipse cx="24" cy="32" rx="8" ry="6" fill="#d6f0cf" />
      <circle cx="18.5" cy="25" r="2.2" fill="#2b3a2b" />
      <circle cx="29.5" cy="25" r="2.2" fill="#2b3a2b" />
      <path d="M20 31 q4 2.5 8 0" stroke="#2b6b3a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="16.5" cy="29" r="1.8" fill="#f6a5b4" opacity="0.7" />
      <circle cx="31.5" cy="29" r="1.8" fill="#f6a5b4" opacity="0.7" />
    </svg>
  ),
  ghost: (
    <svg viewBox="0 0 48 48" width="44" height="44">
      <path d="M10 30 a14 14 0 0 1 28 0 v12 l-4 -3 l-4 3 l-4 -3 l-4 3 l-4 -3 l-4 3 z" fill="#f3f0fb" stroke="#d9d2ef" strokeWidth="0.8" />
      <circle cx="18.5" cy="26" r="2.3" fill="#5b5170" />
      <circle cx="29.5" cy="26" r="2.3" fill="#5b5170" />
      <ellipse cx="24" cy="31" rx="2" ry="2.6" fill="#a99fc4" />
      <circle cx="15.5" cy="30" r="2" fill="#e3b6c8" opacity="0.7" />
      <circle cx="32.5" cy="30" r="2" fill="#e3b6c8" opacity="0.7" />
    </svg>
  ),
  duck: (
    <svg viewBox="0 0 48 48" width="46" height="46">
      <circle cx="24" cy="26" r="15" fill="#ffdf5d" />
      <circle cx="19" cy="23" r="2.1" fill="#3a2b20" />
      <circle cx="29" cy="23" r="2.1" fill="#3a2b20" />
      <path d="M17 28 q7 5 14 0 q-2 -3 -7 -3 q-5 0 -7 3z" fill="#ff9f1c" />
      <circle cx="15.5" cy="27" r="2" fill="#ffb3b3" opacity="0.7" />
      <circle cx="32.5" cy="27" r="2" fill="#ffb3b3" opacity="0.7" />
      <path d="M9 20 q3 -3 7 -2" stroke="#ffcf4d" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  ),
  piglet: (
    <svg viewBox="0 0 48 48" width="46" height="46">
      <path d="M13 13 l5 4 l-6 2 z" fill="#f6a5c0" />
      <path d="M35 13 l-5 4 l6 2 z" fill="#f6a5c0" />
      <circle cx="24" cy="27" r="15" fill="#f9b8cf" />
      <ellipse cx="24" cy="30" rx="6" ry="4.5" fill="#f291b3" />
      <ellipse cx="22" cy="30" rx="1" ry="1.4" fill="#c85e86" />
      <ellipse cx="26" cy="30" rx="1" ry="1.4" fill="#c85e86" />
      <circle cx="18.5" cy="24" r="2" fill="#5b3346" />
      <circle cx="29.5" cy="24" r="2" fill="#5b3346" />
      <circle cx="15.5" cy="28" r="2" fill="#f27ba0" opacity="0.7" />
      <circle cx="32.5" cy="28" r="2" fill="#f27ba0" opacity="0.7" />
    </svg>
  ),
}

/** 吉祥物缩放的锚点(挂在哪个角就以哪个角为原点收缩,预览缩小时不跑位) */
const MASCOT_ORIGIN: Record<NonNullable<BubbleStyle['mascotPos']>, string> = {
  tl: 'top left',
  tr: 'top right',
  bl: 'bottom left',
  br: 'bottom right',
}

/** 渲染角落吉祥物贴纸(会轻轻摇摆);id 不在注册表则不渲染。
 * 外层负责定位+缩放,内层跑摇摆动画,两者 transform 互不覆盖。 */
function Mascot({
  id,
  pos = 'br',
  scale = 1,
}: {
  id: string
  pos?: NonNullable<BubbleStyle['mascotPos']>
  scale?: number
}) {
  const node = MASCOTS[id]
  if (!node) return null
  return (
    <span
      className="pointer-events-none absolute z-20"
      style={{
        ...MASCOT_POS[pos],
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: MASCOT_ORIGIN[pos],
      }}
    >
      <span
        className="mascot-idle inline-block"
        style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.22))' }}
      >
        {node}
      </span>
    </span>
  )
}

/** 气泡手绘装饰:顶饰 + 吉祥物(给发送者的气泡用)。scale 用于 picker 小预览缩放。
 * 说明:早期那种孤立实心小三角尾巴已停用——形状统一改用"非对称圆角当尾巴"
 * (见 bubbleRadius),更干净、能融入渐变与圆角,也不会在渐变气泡上露色差。 */
export function renderBubbleArt(bubble: BubbleStyle, scale = 1) {
  const accent = bubble.accent ?? 'var(--c-primary)'
  return (
    <>
      {bubble.topper && <Topper type={bubble.topper} color={accent} />}
      {bubble.mascot && <Mascot id={bubble.mascot} pos={bubble.mascotPos} scale={scale} />}
    </>
  )
}

/** 连续消息中的位置:决定气泡贴边角的收放 */
export type GroupPos = 'single' | 'first' | 'middle' | 'last'

/** 按 (是否自己, 分组位置) 算四角圆角。发送方一侧的贴边角收小成"尾巴/接缝"。 */
export function bubbleRadius(mine: boolean, pos: GroupPos): string {
  const R = 20
  const S = 7
  const groupedWithPrev = pos === 'middle' || pos === 'last'
  if (mine) {
    // 发送方在右:右上(接上一条时收小)/ 右下(尾巴,恒小)
    const tr = groupedWithPrev ? S : R
    return `${R}px ${tr}px ${S}px ${R}px`
  }
  // 发送方在左:左上(接上一条时收小)/ 左下(尾巴,恒小)
  const tl = groupedWithPrev ? S : R
  return `${tl}px ${R}px ${R}px ${S}px`
}

/** 渲染气泡角落的 emoji 挂件 */
export function renderDecos(deco: BubbleDeco[] | undefined, scale = 1) {
  if (!deco) return null
  return deco.map((d, i) => (
    <span
      key={i}
      className="pointer-events-none absolute z-10 leading-none"
      style={{ ...DECO_POS[d.pos], fontSize: (d.size ?? 18) * scale }}
    >
      {/* 外层定位+静态旋转,内层跑持续动画,两者互不干扰 */}
      <span
        className={d.anim ? `inline-block deco-${d.anim}` : 'inline-block'}
        style={{ transform: d.rot ? `rotate(${d.rot}deg)` : undefined }}
      >
        {d.emoji}
      </span>
    </span>
  ))
}
import type { ChatItem } from '../hooks/useMessages'
import { t } from '../lib/i18n'

/** 图片/表情包消息:待发送时用本地预览,已落库则取私有桶签名 URL */
function ChatImage({
  item,
  onPreview,
  onMediaLoad,
}: {
  item: ChatItem
  onPreview: (url: string) => void
  onMediaLoad?: () => void
}) {
  const [url, setUrl] = useState<string | null>(item.previewUrl ?? null)
  const [errored, setErrored] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const isSticker = item.type === 'sticker'

  useEffect(() => {
    let cancelled = false
    if (item.previewUrl) {
      setUrl(item.previewUrl)
      return
    }
    if (!item.content) return
    setErrored(false)
    getSignedUrl(isSticker ? 'stickers' : 'chat-images', item.content).then((u) => {
      if (cancelled) return
      // 签名失败 → 标记为错误,显示可点重载,而不是永久停在骨架
      if (u) setUrl(u)
      else setErrored(true)
    })
    return () => {
      cancelled = true
    }
  }, [item.content, item.previewUrl, isSticker, reloadKey])

  // 点击重载:清掉可能过期的签名缓存,重新拉一次
  const retry = () => {
    if (item.content) clearSignedUrl(isSticker ? 'stickers' : 'chat-images', item.content)
    setUrl(null)
    setErrored(false)
    setReloadKey((k) => k + 1)
  }

  if (errored) {
    return (
      <button
        type="button"
        onClick={retry}
        className={`flex flex-col items-center justify-center gap-1 rounded-xl bg-line text-xs text-gray-400 ${
          isSticker ? 'h-24 w-24' : 'h-40 w-40'
        }`}
      >
        <span className="text-xl">🔄</span>
        {t('点击重载')}
      </button>
    )
  }
  if (!url) {
    return <div className={`skeleton rounded-xl ${isSticker ? 'h-24 w-24' : 'h-40 w-40'}`} />
  }
  return (
    <img
      src={url}
      alt={isSticker ? t('表情包') : t('图片消息')}
      className={
        isSticker
          ? 'h-24 w-24 rounded-lg object-contain'
          : 'max-h-64 max-w-full rounded-xl object-cover'
      }
      onClick={() => onPreview(url)}
      onLoad={onMediaLoad}
      onError={() => setErrored(true)}
    />
  )
}

// 全局仅允许一条语音在播:开始播新的前先暂停上一条,避免多条同时响
let activeVoiceAudio: HTMLAudioElement | null = null
function claimVoicePlayback(me: HTMLAudioElement) {
  if (activeVoiceAudio && activeVoiceAudio !== me) activeVoiceAudio.pause()
  activeVoiceAudio = me
}

/** 语音消息气泡:点击播放/暂停(可续播),宽度随时长 */
function VoiceBubble({
  item,
  styleObj,
  cornerStyle,
}: {
  item: ChatItem
  /** 发送者气泡样式(双方都用发送者的) */
  styleObj?: CSSProperties
  /** 统一的四角圆角(随分组变化) */
  cornerStyle?: CSSProperties
}) {
  const [playing, setPlaying] = useState(false)
  const [prog, setProg] = useState(0) // 播放进度 0..1,用于波形双色
  const audioRef = useRef<HTMLAudioElement | null>(null)
  let path = ''
  let dur = 0
  try {
    const parsed = JSON.parse(item.content) as { p?: string; d?: number }
    path = parsed.p ?? ''
    dur = parsed.d ?? 0
  } catch {
    // 旧数据或未上传完成
  }
  // 待发/失败的语音 content 为空,parse 不出时长 → 用队列里带的 voiceDur 兜底,不再显示 0"
  if (!dur && item.voiceDur) dur = item.voiceDur
  const unsent = !path // 还没上传,没有可播放的 path

  const toggle = async () => {
    const existing = audioRef.current
    if (playing) {
      existing?.pause()
      return
    }
    // 已加载且未播完 → 从暂停处续播,而不是每次从头 new Audio
    if (existing && !existing.ended) {
      claimVoicePlayback(existing)
      try {
        await existing.play()
        setPlaying(true)
      } catch {
        setPlaying(false)
      }
      return
    }
    if (!path) return
    const url = await getSignedUrl('chat-images', path)
    if (!url) return
    const audio = new Audio(url)
    audioRef.current = audio
    audio.ontimeupdate = () => {
      // webm(华为/鸿蒙 Chromium 录音)常没有头部时长,audio.duration 为 Infinity(且 truthy),
      // 直接做分母会让进度恒为 0、波形双色永不推进。用录制时测得的 dur 兜底。
      const den = Number.isFinite(audio.duration) && audio.duration ? audio.duration : dur
      setProg(den ? audio.currentTime / den : 0)
    }
    audio.onended = () => {
      setPlaying(false)
      setProg(0)
    }
    audio.onpause = () => setPlaying(false)
    claimVoicePlayback(audio)
    try {
      await audio.play() // 自动播放策略拒绝时不让 ▶/⏸ 卡在播放态
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      if (activeVoiceAudio === audioRef.current) activeVoiceAudio = null
    }
  }, [])

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      aria-label={t('语音消息 {n} 秒', { n: dur })}
      className="chat-bubble flex items-center gap-2 px-3.5 py-2.5 text-base"
      style={{
        ...styleObj,
        ...cornerStyle,
        width: 92 + Math.min(dur, 60) * 2,
      }}
    >
      <span>{unsent ? (item.status === 'failed' ? '⚠' : '⏳') : playing ? '⏸' : '▶'}</span>
      <span className="flex flex-1 items-center gap-0.5 overflow-hidden">
        {[3, 7, 5, 9, 4, 8, 5].map((h, i) => {
          // 波形按播放进度双色:已播的柱亮、未播的柱淡(未上传统一淡)
          const played = (i + 1) / 7 <= prog
          return (
            <span
              key={i}
              className="w-0.5 rounded-full transition-opacity"
              style={{
                height: h + 4,
                background: 'currentColor',
                opacity: unsent ? 0.4 : played ? 1 : 0.32,
              }}
            />
          )
        })}
      </span>
      <span className="shrink-0 text-sm">{dur}"</span>
    </button>
  )
}

/** 一条消息气泡:自己靠右(可自定义样式),对方靠左;支持长按菜单、撤回态、已读标注 */
export default function MessageBubble({
  item,
  mine,
  bubble = BUBBLE_STYLES[0],
  font = BUBBLE_FONTS[0],
  readLabel = false,
  onRetry,
  onPreview,
  onMediaLoad,
  onLongPress,
  onDoubleTap,
  replyRecalled = false,
  groupPos = 'single',
}: {
  item: ChatItem
  mine: boolean
  /** 这条消息按其发送者选择的气泡样式(共享;双方都能看到) */
  bubble?: BubbleStyle
  /** 这条消息按其发送者选择的字体(共享) */
  font?: BubbleFont
  /** 连续消息中的位置(驱动尾角/贴边收放) */
  groupPos?: GroupPos
  /** 是否在这条消息下方显示「已读」(只用于自己最新一条已被对方读过的消息) */
  readLabel?: boolean
  onRetry: () => void
  onPreview: (url: string) => void
  /** 图片/表情包加载完成回调:用于加载后重新贴底 */
  onMediaLoad?: () => void
  /** 长按气泡 → 弹出菜单,带气泡屏幕位置用于定位弹窗 */
  onLongPress?: (rect: DOMRect) => void
  /** 双击对方气泡 → 拍一拍 */
  onDoubleTap?: () => void
  /** 被引用的原消息是否已被撤回(是则引用框显示"该消息已撤回") */
  replyRecalled?: boolean
}) {
  const pressTimer = useRef<number | undefined>(undefined)
  const pressElRef = useRef<HTMLElement | null>(null)
  const lastTapRef = useRef(0)

  // 统一四角圆角:带自定义 radius 的花哨款尊重其原形状;其余走非对称尾角(按发送方一侧)
  const cornerStyle: CSSProperties = bubble.radius
    ? {}
    : { borderRadius: bubbleRadius(mine, groupPos) }

  // 已撤回:居中提示,不再显示内容
  if (item.recalled) {
    return (
      <p className="my-1 text-center">
        <span className="chat-center-chip">
          {mine ? t('你撤回了一条消息') : t('对方撤回了一条消息')}
        </span>
      </p>
    )
  }

  // 拍一拍:居中系统提示行
  if (item.type === 'nudge') {
    return (
      <p className="my-1 text-center">
        <span className="chat-center-chip">{mine ? t('你拍了拍 TA') : t('TA 拍了拍你')} 👋</span>
      </p>
    )
  }

  const startPress = (el: HTMLElement) => {
    if (!onLongPress) return
    pressElRef.current = el
    pressTimer.current = window.setTimeout(() => {
      if (pressElRef.current) onLongPress(pressElRef.current.getBoundingClientRect())
    }, 480)
  }
  const cancelPress = () => window.clearTimeout(pressTimer.current)
  /** 触屏双击检测(两次点按 < 300ms) */
  const handleTap = () => {
    if (!onDoubleTap) return
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      lastTapRef.current = 0
      onDoubleTap()
    } else {
      lastTapRef.current = now
    }
  }

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[78%]">
        <div
          onTouchStart={(e) => startPress(e.currentTarget)}
          onTouchEnd={() => {
            cancelPress()
            handleTap()
          }}
          onTouchMove={cancelPress}
          onDoubleClick={() => onDoubleTap?.()}
          onContextMenu={(e) => {
            if (onLongPress) {
              e.preventDefault()
              onLongPress(e.currentTarget.getBoundingClientRect())
            }
          }}
        >
          {item.type === 'voice' ? (
            // 语音气泡也带上发送者的角落装饰/吉祥物(挂件是绝对定位兄弟,不影响播放按钮)
            <span className="relative inline-block">
              <VoiceBubble item={item} styleObj={bubbleCss(bubble)} cornerStyle={cornerStyle} />
              {renderDecos(bubble.deco)}
              {renderBubbleArt(bubble)}
            </span>
          ) : item.type === 'text' ? (
            <div className="relative">
              <div
                className={`chat-bubble whitespace-pre-wrap break-words px-3.5 py-2 text-base leading-relaxed ${bubble.anim ?? ''} ${bubble.extraClass ?? ''}`}
                style={{ ...bubbleCss(bubble), ...fontCss(font), ...cornerStyle }}
              >
                {item.replyPreview && (
                  <div
                    className="mb-1 max-w-full truncate rounded-md border-l-2 border-primary px-2 py-0.5 text-xs opacity-90"
                    style={{ background: 'rgba(127,127,127,0.18)' }}
                  >
                    {replyRecalled ? t('该消息已撤回') : item.replyPreview}
                  </div>
                )}
                {item.content}
              </div>
              {renderDecos(bubble.deco)}
              {renderBubbleArt(bubble)}
            </div>
          ) : (
            <ChatImage item={item} onPreview={onPreview} onMediaLoad={onMediaLoad} />
          )}
        </div>

        {item.status === 'sending' && (
          <p className="mt-0.5 text-right text-xs text-gray-300">{t('发送中…')}</p>
        )}
        {item.status === 'failed' && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-0.5 w-full text-right text-xs text-red-500"
          >
            {t('⚠ 发送失败,点击重试')}
          </button>
        )}
        {item.status === 'sent' && readLabel && (
          <p className="read-in mt-0.5 text-right text-xs text-gray-300">
            <span className="read-heart mr-0.5 text-rose-300" aria-hidden="true">♡</span>
            {t('已读')}
          </p>
        )}
      </div>
    </div>
  )
}
