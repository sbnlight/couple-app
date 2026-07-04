import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAnniversaries } from '../hooks/useAnniversaries'
import { onLive } from '../lib/live'
import { fireEffect } from '../lib/effects'
import { isThumbkissOpen, openThumbkiss } from '../lib/thumbkissStore'
import { daysUntil } from '../lib/time'
import { t } from '../lib/i18n'

/**
 * 全局互动监听(挂在主布局):
 * - 对方点了「想 TA」→ 爱心雨 + 提示
 * - 今天是纪念日/见面日 → 开屏撒花彩蛋(每天每设备一次)
 */
export default function GlobalLive() {
  const { couple, partner } = useAuth()
  const { list: anniversaries } = useAnniversaries(couple!.id)
  const [toast, setToast] = useState('')
  const [touchInvite, setTouchInvite] = useState(false)
  const lastInviteRef = useRef(0)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // 对方开始实时触碰(且我不在触碰页)→ 弹一个可点提醒,一点就打开触碰页一起碰。
  // 触碰是每 0.8s 心跳重播的,这里按 12s 节流,避免同一次触碰反复弹提醒。
  useEffect(() => {
    return onLive('touch', (p) => {
      if (!p.on || isThumbkissOpen()) return
      if (Date.now() - lastInviteRef.current < 12_000) return
      lastInviteRef.current = Date.now()
      setTouchInvite(true)
      setTimeout(() => setTouchInvite(false), 8000)
    })
  }, [])

  // 对方想你 → 爱心雨(带上 TA 的表情与悄悄话)
  useEffect(() => {
    return onLive('miss', (p) => {
      const emoji = typeof p.emoji === 'string' && p.emoji ? p.emoji : '💭'
      const note = typeof p.note === 'string' ? p.note.trim() : ''
      fireEffect([emoji, '💕', '💗', '❤️'], 32)
      const who = partner?.display_name ?? t('TA')
      showToast(note ? `${who}: ${note} ${emoji}` : t('TA 正在想你 {e}', { e: emoji }))
    })
  }, [partner?.display_name])

  // 纪念日彩蛋:见面日精确匹配;纪念日按"月-日"每年触发
  useEffect(() => {
    if (anniversaries.length === 0 && !couple?.next_meet_date) return
    const now = new Date()
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const key = `celebrated-${todayLocal}`
    if (sessionStorage.getItem(key)) return

    let title: string | null = null
    if (couple?.next_meet_date && daysUntil(couple.next_meet_date) === 0) {
      title = t('今天就要见面啦 ✈️')
    } else {
      const md = todayLocal.slice(5)
      const hit = anniversaries.find((a) => a.anniv_date.slice(5) === md)
      if (hit) title = t('今天是「{t}」🎉', { t: hit.title })
    }
    if (title) {
      sessionStorage.setItem(key, '1')
      setTimeout(() => {
        fireEffect(['🎉', '🎊', '💕', '✨'], 40)
        showToast(title!)
      }, 600)
    }
  }, [anniversaries, couple?.next_meet_date])

  if (!toast && !touchInvite) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[95] flex flex-col items-center gap-2 px-4">
      {toast && (
        <span className="rounded-full bg-gray-800/85 px-4 py-2 text-sm text-white">{toast}</span>
      )}
      {touchInvite && (
        <button
          type="button"
          onClick={() => {
            setTouchInvite(false)
            openThumbkiss()
          }}
          className="pointer-events-auto animate-bounce rounded-full bg-rose-500/95 px-4 py-2 text-sm font-medium text-white shadow-lg active:scale-95"
        >
          💞 {t('{name}想和你实时触碰 · 点这里一起碰', { name: partner?.display_name ?? t('TA') })}
        </button>
      )}
    </div>
  )
}
