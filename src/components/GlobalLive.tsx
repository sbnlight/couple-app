import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAnniversaries } from '../hooks/useAnniversaries'
import { onLive } from '../lib/live'
import { fireEffect } from '../lib/effects'
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

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

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

  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[95] flex justify-center">
      <span className="rounded-full bg-gray-800/85 px-4 py-2 text-sm text-white">{toast}</span>
    </div>
  )
}
