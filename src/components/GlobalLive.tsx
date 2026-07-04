import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAnniversaries } from '../hooks/useAnniversaries'
import { onLive } from '../lib/live'
import { fireEffect } from '../lib/effects'
import { isThumbkissOpen, openThumbkiss } from '../lib/thumbkissStore'
import { daysUntil, todayInTz, recurringUntil } from '../lib/time'
import { dayTzOf } from './FeatureToggles'
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

  const toastTimerRef = useRef<number | undefined>(undefined)
  const showToast = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 3000)
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

  // 纪念日彩蛋:用共用换日时区取「今天」;循环纪念日按 recurringUntil(闰日安全)判定;
  // 键与 Us 的 special-day 统一,避免同一天 GlobalLive + Us 各撒一次花
  useEffect(() => {
    if (anniversaries.length === 0 && !couple?.next_meet_date) return
    const tz = dayTzOf(couple)
    const today = todayInTz(tz)
    const key = `special-day-${today}`
    if (sessionStorage.getItem(key)) return

    let title: string | null = null
    if (couple?.next_meet_date && daysUntil(couple.next_meet_date, tz) === 0) {
      title = t('今天就要见面啦 ✈️')
    } else {
      const hit = anniversaries.find((a) =>
        a.recurring ? recurringUntil(a.anniv_date, tz).days === 0 : a.anniv_date === today,
      )
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
