import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/image'
import { getSignedUrl } from '../lib/storage'
import {
  BUBBLE_FONTS,
  BUBBLE_STYLES,
  CHAT_BGS,
  bubbleCss,
  fontCss,
  getBubbleFont,
  getBubbleStyle,
  getChatBgToken,
  saveBubbleFont,
  saveBubbleStyle,
  saveChatBgToken,
} from '../lib/prefs'
import { t } from '../lib/i18n'
import { renderBubbleArt, renderDecos } from './MessageBubble'

type Page = 'menu' | 'bubble' | 'bg' | 'font'

/** 子选择页的通用外壳 */
function PickerPage({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-warmbg">
      <header className="flex items-center gap-2 border-b border-line bg-white/85 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
        <button type="button" onClick={onBack} className="px-1 text-2xl text-gray-400">
          ‹
        </button>
        <h1 className="text-base font-semibold text-primary-dark">{title}</h1>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
    </div>
  )
}

/**
 * 聊天外观设置:入口菜单 → 修改气泡 / 修改聊天背景 / 修改字体 三个选择页。
 * 全部为本机偏好;自定义背景图传到私有桶(avatars 桶自己的目录下)。
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
  const [page, setPage] = useState<Page>('menu')
  const [bubbleId, setBubbleId] = useState(() => getBubbleStyle().id)
  const [fontId, setFontId] = useState(() => getBubbleFont().id)
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
  const pickFont = (id: string) => {
    saveBubbleFont(id)
    setFontId(id)
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
      const old = getChatBgToken()
      if (old.startsWith('custom:')) void supabase.storage.from('avatars').remove([old.slice(7)])
      const token = `custom:${path}`
      saveChatBgToken(token)
      setBgToken(token)
      onChanged()
      onToast(t('背景已更换'))
    } catch {
      onToast(t('背景上传失败,请重试'))
    } finally {
      setUploading(false)
    }
  }

  const currentBubble = BUBBLE_STYLES.find((b) => b.id === bubbleId) ?? BUBBLE_STYLES[0]
  const currentFont = BUBBLE_FONTS.find((f) => f.id === fontId) ?? BUBBLE_FONTS[0]
  const currentBgLabel = bgToken.startsWith('custom:')
    ? t('相册图片')
    : t(CHAT_BGS.find((b) => b.id === bgToken.slice(7))?.label ?? '默认')

  const bubbleGroups = [...new Set(BUBBLE_STYLES.map((b) => b.group))]
  const bgGroups = [...new Set(CHAT_BGS.map((b) => b.group))]

  /* ---------- 子页:气泡 ---------- */
  if (page === 'bubble') {
    return (
      <PickerPage title={t('修改气泡')} onBack={() => setPage('menu')}>
        {bubbleGroups.map((g) => (
          <div key={g} className="mb-5">
            <p className="mb-2 px-1 text-xs text-gray-400">{t(g)}</p>
            <div className="grid grid-cols-3 gap-3">
              {BUBBLE_STYLES.filter((b) => b.group === g).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => pickBubble(b.id)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="relative w-full">
                    <span
                      className={`flex h-11 w-full items-center justify-center rounded-2xl rounded-br-sm text-sm ${b.anim ?? ''} ${b.extraClass ?? ''} ${
                        bubbleId === b.id ? 'ring-2 ring-gray-700 ring-offset-2' : ''
                      }`}
                      style={bubbleCss(b)}
                    >
                      {t('你好呀')}
                    </span>
                    {renderDecos(b.deco, 0.85)}
                    {renderBubbleArt(b)}
                  </span>
                  <span className="text-xs text-gray-500">{t(b.label)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </PickerPage>
    )
  }

  /* ---------- 子页:背景 ---------- */
  if (page === 'bg') {
    return (
      <PickerPage title={t('修改聊天背景')} onBack={() => setPage('menu')}>
        <p className="mb-2 px-1 text-xs text-gray-400">{t('自定义')}</p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className={`relative mb-5 flex h-20 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-line text-sm text-gray-400 disabled:opacity-50 ${
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
          <span className="relative rounded-full bg-white/85 px-2 py-1">
            {uploading ? t('上传中…') : t('📷 从相册选择')}
          </span>
        </button>

        {bgGroups.map((g) => (
          <div key={g} className="mb-5">
            <p className="mb-2 px-1 text-xs text-gray-400">{t(g)}</p>
            <div className="grid grid-cols-3 gap-2">
              {CHAT_BGS.filter((b) => b.group === g).map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => pickPreset(bg.id)}
                  className={`flex h-20 items-end justify-center rounded-xl border border-line pb-1.5 ${
                    bgToken === `preset:${bg.id}` ? 'ring-2 ring-gray-700 ring-offset-1' : ''
                  }`}
                  style={bg.css ? { background: bg.css } : undefined}
                >
                  <span
                    className={`rounded-full px-1.5 text-xs ${
                      g === '深色' ? 'bg-black/30 text-white/90' : 'bg-white/70 text-gray-500'
                    }`}
                  >
                    {t(bg.label)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleCustom(e)}
        />
      </PickerPage>
    )
  }

  /* ---------- 子页:字体 ---------- */
  if (page === 'font') {
    return (
      <PickerPage title={t('修改字体')} onBack={() => setPage('menu')}>
        <p className="mb-3 px-1 text-xs text-gray-400">
          {t('只改变你自己发出的文字;个别设备缺少某字体时会自动用近似效果')}
        </p>
        <div className="space-y-3">
          {BUBBLE_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => pickFont(f.id)}
              className={`flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 ${
                fontId === f.id ? 'ring-2 ring-gray-700 ring-offset-1' : ''
              }`}
            >
              <span
                className="rounded-2xl rounded-br-sm px-3.5 py-2 text-base"
                style={{ ...bubbleCss(currentBubble), ...fontCss(f) }}
              >
                {t('晚安,好梦呀')}
              </span>
              <span className="text-sm text-gray-500">{t(f.label)}</span>
            </button>
          ))}
        </div>
      </PickerPage>
    )
  }

  /* ---------- 入口菜单 ---------- */
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-t-2xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="border-b border-line py-3 text-center text-sm font-medium text-gray-500">
          {t('聊天外观')}
        </p>
        <div className="divide-y divide-line">
          <button
            type="button"
            onClick={() => setPage('bubble')}
            className="flex w-full items-center justify-between px-5 py-3.5 active:bg-soft"
          >
            <span>{t('💬 修改气泡')}</span>
            <span className="flex items-center gap-2 text-sm text-gray-400">
              {t(currentBubble.label)}
              <span className="text-gray-300">›</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPage('bg')}
            className="flex w-full items-center justify-between px-5 py-3.5 active:bg-soft"
          >
            <span>{t('🖼 修改聊天背景')}</span>
            <span className="flex items-center gap-2 text-sm text-gray-400">
              {currentBgLabel}
              <span className="text-gray-300">›</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPage('font')}
            className="flex w-full items-center justify-between px-5 py-3.5 active:bg-soft"
          >
            <span>{t('🔤 修改字体')}</span>
            <span className="flex items-center gap-2 text-sm text-gray-400">
              {t(currentFont.label)}
              <span className="text-gray-300">›</span>
            </span>
          </button>
        </div>
        <p className="px-5 pt-2 text-xs text-gray-300">{t('以上设置只对这台设备生效')}</p>
        <button
          type="button"
          className="mt-2 w-full border-t border-line py-3 text-center text-gray-500"
          onClick={onClose}
        >
          {t('完成')}
        </button>
      </div>
    </div>
  )
}
