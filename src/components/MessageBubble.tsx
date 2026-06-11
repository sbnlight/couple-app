import { useEffect, useState } from 'react'
import { getSignedUrl } from '../lib/storage'
import type { ChatItem } from '../hooks/useMessages'

/** 图片消息:待发送时用本地预览,已落库则取私有桶签名 URL */
function ChatImage({ item, onPreview }: { item: ChatItem; onPreview: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(item.previewUrl ?? null)

  useEffect(() => {
    let cancelled = false
    if (item.previewUrl) {
      setUrl(item.previewUrl)
      return
    }
    if (!item.content) return
    getSignedUrl('chat-images', item.content).then((u) => {
      if (!cancelled && u) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [item.content, item.previewUrl])

  if (!url) return <div className="h-40 w-40 animate-pulse rounded-xl bg-line" />
  return (
    <img
      src={url}
      alt="图片消息"
      className="max-h-64 max-w-full rounded-xl object-cover"
      onClick={() => onPreview(url)}
    />
  )
}

/** 一条消息气泡:自己靠右(主题色),对方靠左(白色);带发送状态 */
export default function MessageBubble({
  item,
  mine,
  onRetry,
  onPreview,
}: {
  item: ChatItem
  mine: boolean
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
      </div>
    </div>
  )
}
