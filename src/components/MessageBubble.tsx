import { useEffect, useState } from 'react'
import { getSignedUrl } from '../lib/storage'
import type { ChatItem } from '../hooks/useMessages'

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
      <div
        className={`animate-pulse rounded-xl bg-line ${isSticker ? 'h-24 w-24' : 'h-40 w-40'}`}
      />
    )
  }
  // 表情包显示为小图;照片可以更大,点击都能全屏查看
  return (
    <img
      src={url}
      alt={isSticker ? '表情包' : '图片消息'}
      className={
        isSticker
          ? 'h-24 w-24 rounded-lg object-contain'
          : 'max-h-64 max-w-full rounded-xl object-cover'
      }
      onClick={() => onPreview(url)}
    />
  )
}

/** 一条消息气泡:自己靠右(主题色),对方靠左(白色);带发送状态与已读标注 */
export default function MessageBubble({
  item,
  mine,
  readLabel = false,
  onRetry,
  onPreview,
}: {
  item: ChatItem
  mine: boolean
  /** 是否在这条消息下方显示「已读」(只用于自己最新一条已被对方读过的消息) */
  readLabel?: boolean
  onRetry: () => void
  onPreview: (url: string) => void
}) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[78%]">
        {item.type === 'text' ? (
          <div
            className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-base leading-relaxed ${
              mine ? 'rounded-br-sm bg-primary text-white' : 'rounded-bl-sm bg-white'
            }`}
          >
            {item.content}
          </div>
        ) : (
          <ChatImage item={item} onPreview={onPreview} />
        )}

        {item.status === 'sending' && (
          <p className="mt-0.5 text-right text-xs text-gray-300">发送中…</p>
        )}
        {item.status === 'failed' && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-0.5 w-full text-right text-xs text-red-500"
          >
            ⚠ 发送失败,点击重试
          </button>
        )}
        {item.status === 'sent' && readLabel && (
          <p className="mt-0.5 text-right text-xs text-gray-300">已读</p>
        )}
      </div>
    </div>
  )
}
