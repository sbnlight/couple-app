import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/image'
import { getSignedUrl } from '../lib/storage'
import {
  BUBBLE_STYLES,
  CHAT_BGS,
  getBubbleStyle,
  getChatBgToken,
  saveBubbleStyle,
  saveChatBgToken,
} from '../lib/prefs'

/**
 * 聊天外观设置(底部弹层):自己的气泡样式 + 聊天背景。
 * 都是本机偏好;自定义背景图传到私有桶(avatars 桶自己的目录下)。
 */
export default function ChatAppearance({
  userId,
  onChanged,
  onClose,
  onToast,
}: {
  userId: string
  onChanged: () => void
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const [bubbleId, setBubbleId] = useState(() => getBubbleStyle().id)
  const [bgToken, setBgToken] = useState(getChatBgToken)
  const [customThumb, setCustomThumb] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 当前是自定义背景时,取缩略图
  useEffect(() => {
    if (!bgToken.startsWith('custom:')) {
      setCustomThumb(null)
      return
    }
    let cancelled = false
    getSignedUrl('avatars', bgToken.slice(7)).then((u) => {
      if (!cancelled) setCustomThumb(u)
    })
    return () => {
      cancelled = true
    }
  }, [bgToken])

  const pickBubble = (id: string) => {
    saveBubbleStyle(id)
    setBubbleId(id)
    onChanged()
  }

  const pickPreset = (id: string) => {
    const token = `preset:${id}`
    saveChatBgToken(token)
    setBgToken(token)
    onChanged()
  }

  const handleCustom = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || uploading) return
    setUploading(true)
    try {
      const blob = await compressImage(file, 1280, 0.8)
      const path = `${userId}/chatbg-${Date.now()}.jpg`
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      // 清掉上一张自定义背景,省存储
      const old = getChatBgToken()
      if (old.startsWith('custom:')) void supabase.storage.from('avatars').remove([old.slice(7)])
      const token = `custom:${path}`
      saveChatBgToken(token)
      setBgToken(token)
      onChanged()
      onToast('背景已更换')
    } catch {
      onToast('背景上传失败,请重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-center text-sm font-medium text-gray-500">聊天外观</p>

        {/* 气泡样式 */}
        <p className="text-sm font-medium text-gray-500">我的气泡</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {BUBBLE_STYLES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => pickBubble(b.id)}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`flex h-9 w-16 items-center justify-center rounded-2xl rounded-br-sm text-xs ${
                  bubbleId === b.id ? 'ring-2 ring-gray-700 ring-offset-2' : ''
                }`}
                style={{ background: b.bg, color: b.text }}
              >
                你好
              </span>
              <span className="text-xs text-gray-500">{b.label}</span>
            </button>
          ))}
        </div>

        {/* 聊天背景 */}
        <p className="mt-5 text-sm font-medium text-gray-500">聊天背景</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {CHAT_BGS.map((bg) => (
            <button
              key={bg.id}
              type="button"
              onClick={() => pickPreset(bg.id)}
              className={`flex h-16 items-end justify-center rounded-xl border border-line pb-1 ${
                bgToken === `preset:${bg.id}` ? 'ring-2 ring-gray-700 ring-offset-1' : ''
              }`}
              style={bg.css ? { background: bg.css } : undefined}
            >
              <span
                className={`rounded-full px-1.5 text-xs ${
                  bg.id === 'night' ? 'text-white/80' : 'text-gray-500'
                }`}
              >
                {bg.label}
              </span>
            </button>
          ))}
          {/* 自定义:相册选图 */}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className={`relative flex h-16 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line text-xs text-gray-400 disabled:opacity-50 ${
              bgToken.startsWith('custom:') ? 'ring-2 ring-gray-700 ring-offset-1' : ''
            }`}
          >
            {customThumb && (
              <img
                src={customThumb}
                alt="自定义背景"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <span className="relative rounded-full bg-white/80 px-1.5 py-0.5">
              {uploading ? '上传中…' : '📷 相册'}
            </span>
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-300">以上设置只对这台设备生效</p>

        <button
          type="button"
          className="mt-4 w-full border-t border-line py-3 text-center text-gray-500"
          onClick={onClose}
        >
          完成
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleCustom(e)}
      />
    </div>
  )
}
