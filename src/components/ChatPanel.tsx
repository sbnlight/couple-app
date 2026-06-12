import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useStickers } from '../hooks/useStickers'
import { getSignedUrl } from '../lib/storage'
import type { Sticker } from '../types/db'

/** 常用 emoji(微信式面板,纯文本插入输入框) */
const EMOJIS = [
  '😀', '😄', '😁', '😆', '🤣', '😂', '🙂', '😉', '😊', '🥰',
  '😍', '😘', '😗', '😚', '😋', '😜', '🤪', '😝', '🤗', '🤭',
  '🤔', '🤨', '😐', '😶', '😏', '🙄', '😪', '😴', '🥱', '😷',
  '🥳', '😎', '🤓', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺',
  '😢', '😭', '😤', '😠', '😡', '🤬', '😈', '👿', '💀', '💩',
  '🤡', '👻', '😺', '😸', '😹', '😻', '🙈', '🙉', '🙊', '💋',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💞',
  '💓', '💗', '💖', '💘', '💝', '💟', '💔', '✨', '🌹', '🌸',
  '👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '🤳', '👋', '🤙',
  '🎉', '🎂', '🍰', '🍜', '🍔', '🧋', '☕', '🌙', '☀️', '⭐',
]

/** 单个表情包缩略图(私有桶签名 URL) */
function StickerThumb({ sticker, onClick }: { sticker: Sticker; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    getSignedUrl('stickers', sticker.path).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [sticker.path])
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-soft"
    >
      {url ? (
        <img src={url} alt="表情包" className="h-full w-full object-cover" />
      ) : (
        <span className="animate-pulse text-gray-300">…</span>
      )}
    </button>
  )
}

/**
 * 表情面板:emoji(插入输入框)+ 自定义表情包(直接发送)。
 * 表情包小屋内共享;「管理」模式下可删除自己收藏的。
 */
export default function ChatPanel({
  coupleId,
  userId,
  onEmoji,
  onSticker,
  onToast,
}: {
  coupleId: string
  userId: string
  onEmoji: (emoji: string) => void
  onSticker: (path: string) => void
  onToast: (msg: string) => void
}) {
  const [tab, setTab] = useState<'emoji' | 'sticker'>('emoji')
  const [managing, setManaging] = useState(false)
  const [busy, setBusy] = useState(false)
  const { stickers, loading, add, remove } = useStickers(coupleId, userId)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAdd = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || busy) return
    setBusy(true)
    try {
      await add(file)
      onToast('已添加到表情包')
    } catch {
      onToast('添加失败,请重试')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (s: Sticker) => {
    try {
      await remove(s)
    } catch {
      onToast('删除失败,请重试')
    }
  }

  return (
    <div className="border-t border-line bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      {/* 标签切换 */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <button
          type="button"
          onClick={() => setTab('emoji')}
          className={`rounded-full px-3 py-1 text-sm ${tab === 'emoji' ? 'bg-soft text-primary-dark' : 'text-gray-400'}`}
        >
          😀 表情
        </button>
        <button
          type="button"
          onClick={() => setTab('sticker')}
          className={`rounded-full px-3 py-1 text-sm ${tab === 'sticker' ? 'bg-soft text-primary-dark' : 'text-gray-400'}`}
        >
          ⭐ 表情包
        </button>
        {tab === 'sticker' && stickers.some((s) => s.owner_id === userId) && (
          <button
            type="button"
            onClick={() => setManaging(!managing)}
            className="ml-auto text-sm text-gray-400"
          >
            {managing ? '完成' : '管理'}
          </button>
        )}
      </div>

      <div className="h-56 overflow-y-auto p-3">
        {tab === 'emoji' ? (
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onEmoji(e)}
                className="rounded-lg py-1 text-2xl active:bg-soft"
              >
                {e}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {/* 添加按钮 */}
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-line text-2xl text-gray-300 disabled:opacity-50"
            >
              {busy ? '⏳' : '＋'}
            </button>
            {stickers.map((s) => (
              <div key={s.id} className="relative">
                <StickerThumb
                  sticker={s}
                  onClick={() => {
                    if (!managing) onSticker(s.path)
                  }}
                />
                {managing && s.owner_id === userId && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(s)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {!loading && stickers.length === 0 && (
              <p className="col-span-3 self-center text-sm text-gray-300">
                点 ＋ 从相册收藏你们的专属表情包
              </p>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleAdd(e)}
      />
    </div>
  )
}
