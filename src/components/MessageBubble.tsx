import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
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
function ChatImage({ item, onPreview }: { item: ChatItem; onPreview: (url: string) => void }) {
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
    />
  )
}

/** 语音消息气泡:点击播放/暂停,宽度随时长 */
function VoiceBubble({
  item,
  mine,
  styleObj,
}: {
  item: ChatItem
  mine: boolean
  styleObj?: CSSProperties
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
    if (playing) {
      audioRef.current?.pause()
      return
    }
    if (!path) return
    const url = await getSignedUrl('chat-images', path)
    if (!url) return
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setPlaying(false)
    audio.onpause = () => setPlaying(false)
    void audio.play()
    setPlaying(true)
  }

  useEffect(() => {
    return () => audioRef.current?.pause()
  }, [])

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-base ${
        mine ? 'rounded-br-sm' : 'rounded-bl-sm bg-white'
      }`}
      style={{ ...(mine ? styleObj : {}), width: 92 + Math.min(dur, 60) * 2 }}
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
  onLongPress,
  onDoubleTap,
}: {
  item: ChatItem
  mine: boolean
  /** 自己气泡的样式(本机偏好) */
  bubble?: BubbleStyle
  /** 自己文字的字体(本机偏好) */
  font?: BubbleFont
  /** 是否在这条消息下方显示「已读」(只用于自己最新一条已被对方读过的消息) */
  readLabel?: boolean
  onRetry: () => void
  onPreview: (url: string) => void
  onLongPress?: () => void
  /** 双击对方气泡 → 拍一拍 */
  onDoubleTap?: () => void
}) {
  const pressTimer = useRef<number | undefined>(undefined)
  const lastTapRef = useRef(0)

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

  const startPress = () => {
    if (!onLongPress) return
    pressTimer.current = window.setTimeout(onLongPress, 480)
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
          onTouchStart={startPress}
          onTouchEnd={() => {
            cancelPress()
            handleTap()
          }}
          onTouchMove={cancelPress}
          onDoubleClick={() => onDoubleTap?.()}
          onContextMenu={(e) => {
            if (onLongPress) {
              e.preventDefault()
              onLongPress()
            }
          }}
        >
          {item.type === 'voice' ? (
            <VoiceBubble item={item} mine={mine} styleObj={bubbleCss(bubble)} />
          ) : item.type === 'text' ? (
            <div className="relative">
              <div
                className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-base leading-relaxed ${
                  mine
                    ? `rounded-br-sm ${bubble.anim ?? ''} ${bubble.extraClass ?? ''}`
                    : 'rounded-bl-sm bg-white'
                }`}
                style={mine ? { ...bubbleCss(bubble), ...fontCss(font) } : undefined}
              >
                {item.content}
              </div>
              {mine && renderDecos(bubble.deco)}
            </div>
          ) : (
            <ChatImage item={item} onPreview={onPreview} />
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
