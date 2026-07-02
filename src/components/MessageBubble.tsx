import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { getSignedUrl } from '../lib/storage'
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

/** 气泡手绘装饰:顶饰(给自己的气泡用)。
 * 说明:早期那种孤立实心小三角尾巴已停用——形状统一改用"非对称圆角当尾巴"
 * (见 bubbleRadius),更干净、能融入渐变与圆角,也不会在渐变气泡上露色差。 */
export function renderBubbleArt(bubble: BubbleStyle) {
  const accent = bubble.accent ?? 'var(--c-primary)'
  return <>{bubble.topper && <Topper type={bubble.topper} color={accent} />}</>
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
  const isSticker = item.type === 'sticker'

  useEffect(() => {
    let cancelled = false
    if (item.previewUrl) {
      setUrl(item.previewUrl)
      return
    }
    if (!item.content) return
    getSignedUrl(isSticker ? 'stickers' : 'chat-images', item.content).then((u) => {
      if (!cancelled && u) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [item.content, item.previewUrl, isSticker])

  if (!url) {
    return (
      <div className={`animate-pulse rounded-xl bg-line ${isSticker ? 'h-24 w-24' : 'h-40 w-40'}`} />
    )
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
    audio.onended = () => setPlaying(false)
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
      className="chat-bubble flex items-center gap-2 px-3.5 py-2.5 text-base"
      style={{
        ...styleObj,
        ...cornerStyle,
        width: 92 + Math.min(dur, 60) * 2,
      }}
    >
      <span>{playing ? '⏸' : '▶'}</span>
      <span className="flex flex-1 items-center gap-0.5 overflow-hidden">
        {[3, 7, 5, 9, 4, 8, 5].map((h, i) => (
          <span
            key={i}
            className={`w-0.5 rounded-full ${playing ? 'animate-pulse' : ''}`}
            style={{ height: h + 4, background: 'currentColor', opacity: 0.75 }}
          />
        ))}
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

  // 已撤回:居中灰字提示,不再显示内容
  if (item.recalled) {
    return (
      <p className="my-1 text-center text-xs text-gray-300">
        {mine ? t('你撤回了一条消息') : t('对方撤回了一条消息')}
      </p>
    )
  }

  // 拍一拍:居中系统提示行
  if (item.type === 'nudge') {
    return (
      <p className="my-1 text-center text-xs text-gray-300">
        {mine ? t('你拍了拍 TA') : t('TA 拍了拍你')} 👋
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
            <VoiceBubble item={item} styleObj={bubbleCss(bubble)} cornerStyle={cornerStyle} />
          ) : item.type === 'text' ? (
            <div className="relative">
              <div
                className={`chat-bubble whitespace-pre-wrap break-words px-3.5 py-2 text-base leading-relaxed ${bubble.anim ?? ''} ${bubble.extraClass ?? ''}`}
                style={{ ...bubbleCss(bubble), ...fontCss(font), ...cornerStyle }}
              >
                {item.replyPreview && (
                  <div
                    className="mb-1 max-w-full truncate rounded-md px-2 py-0.5 text-xs opacity-90"
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
          <p className="mt-0.5 text-right text-xs text-gray-300">{t('已读')}</p>
        )}
      </div>
    </div>
  )
}
