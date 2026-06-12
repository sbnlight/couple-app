import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { prevUtcDay, utcToday } from '../lib/time'
import { sendLive } from '../lib/live'
import { fireEffect } from '../lib/effects'
import type { Checkin } from '../types/db'
import { t } from '../lib/i18n'

/** 连续天数徽章:7🔥 / 30🏅 / 100💯 */
const badgeOf = (n: number) => (n >= 100 ? ' 💯' : n >= 30 ? ' 🏅' : n >= 7 ? ' 🔥' : '')

/** 从打卡日期集合算连续天数(今天没打就从昨天往前数) */
function streakOf(days: Set<string>): number {
  let cur = utcToday()
  if (!days.has(cur)) cur = prevUtcDay(cur)
  let n = 0
  while (days.has(cur)) {
    n++
    cur = prevUtcDay(cur)
  }
  return n
}

/**
 * 「今日小互动」卡片:想你按钮(当日互相计数)+ 每日打卡(连续天数)。
 * "今天"统一按 UTC 日期,保证异地两人一致。
 */
export default function MomentsCard({
  coupleId,
  userId,
  partnerName,
  onToast,
  missEnabled = true,
  checkinEnabled = true,
}: {
  coupleId: string
  userId: string
  partnerName: string
  onToast: (msg: string) => void
  /** 功能开关(小屋级):关闭的部分不显示 */
  missEnabled?: boolean
  checkinEnabled?: boolean
}) {
  const [missMine, setMissMine] = useState(0)
  const [missTheirs, setMissTheirs] = useState(0)
  const [checkedToday, setCheckedToday] = useState(false)
  const [theirCheckedToday, setTheirCheckedToday] = useState(false)
  const [streakMine, setStreakMine] = useState(0)
  const [streakTheirs, setStreakTheirs] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const today = utcToday()
    const [missRes, checkRes] = await Promise.all([
      supabase
        .from('misses')
        .select('user_id')
        .eq('couple_id', coupleId)
        .gte('created_at', `${today}T00:00:00Z`),
      // 取最近 120 天的打卡记录用于算连续天数
      supabase
        .from('checkins')
        .select('*')
        .eq('couple_id', coupleId)
        .order('day', { ascending: false })
        .limit(240),
    ])
    if (missRes.data) {
      const rows = missRes.data as { user_id: string }[]
      setMissMine(rows.filter((r) => r.user_id === userId).length)
      setMissTheirs(rows.filter((r) => r.user_id !== userId).length)
    }
    if (checkRes.data) {
      const rows = checkRes.data as Checkin[]
      const mine = new Set(rows.filter((r) => r.user_id === userId).map((r) => r.day))
      const theirs = new Set(rows.filter((r) => r.user_id !== userId).map((r) => r.day))
      setCheckedToday(mine.has(today))
      setTheirCheckedToday(theirs.has(today))
      setStreakMine(streakOf(mine))
      setStreakTheirs(streakOf(theirs))
    }
  }, [coupleId, userId])

  useEffect(() => {
    void load()
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  /** 想你 +1 */
  const handleMiss = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('misses')
        .insert({ couple_id: coupleId, user_id: userId })
      if (error) throw error
      setMissMine((n) => n + 1)
      // 对方如果正开着 App,立刻下一场爱心雨
      sendLive('miss')
      fireEffect(['💭', '💗'], 12)
      onToast(t('已经告诉 TA 你在想 TA 了 💭'))
    } catch {
      onToast(t('网络不太好,请重试'))
    } finally {
      setBusy(false)
    }
  }

  /** 今日打卡 */
  const handleCheckin = async () => {
    if (busy || checkedToday) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('checkins')
        .insert({ couple_id: coupleId, user_id: userId, day: utcToday() })
      if (error) throw error
      const newStreak = streakMine + 1
      await load()
      if ([7, 30, 100, 365].includes(newStreak)) {
        fireEffect(['🔥', '🎉', '🏅'], 36)
        onToast(t('连续打卡 {n} 天!太厉害了 🎉', { n: newStreak }))
      } else {
        onToast(t('打卡成功 ✅'))
      }
    } catch {
      onToast(t('网络不太好,请重试'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{t('今日小互动')}</p>
      <div className={`mt-3 grid gap-3 ${missEnabled && checkinEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {missEnabled && (
          <button
            type="button"
            onClick={() => void handleMiss()}
            disabled={busy}
            className="rounded-xl bg-soft py-3 text-center active:opacity-70 disabled:opacity-50"
          >
            <span className="block text-2xl">💭</span>
            <span className="mt-1 block text-sm font-medium text-primary-dark">{t('想 TA')}</span>
          </button>
        )}
        {checkinEnabled && (
          <button
            type="button"
            onClick={() => void handleCheckin()}
            disabled={busy || checkedToday}
            className={`rounded-xl py-3 text-center active:opacity-70 ${
              checkedToday ? 'bg-gray-100' : 'bg-soft'
            }`}
          >
            <span className="block text-2xl">{checkedToday ? '✅' : '📍'}</span>
            <span className="mt-1 block text-sm font-medium text-primary-dark">
              {checkedToday ? t('今日已打卡') : t('每日打卡')}
            </span>
          </button>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-gray-400">
        {missEnabled && (
          <>
            {t('今天:你想了 TA {a} 次,{name}想了你 {b} 次', {
              a: missMine,
              b: missTheirs,
              name: partnerName,
            })}
            {checkinEnabled && <br />}
          </>
        )}
        {checkinEnabled && (
          <>
            {t('打卡:你已连续 {a} 天{ab},{name}已连续 {b} 天{bb}', {
              a: streakMine,
              ab: badgeOf(streakMine),
              b: streakTheirs,
              bb: badgeOf(streakTheirs),
              name: partnerName,
            })}
            {theirCheckedToday && t(' · TA 今天已打卡')}
          </>
        )}
      </p>
    </div>
  )
}
