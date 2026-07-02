import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dayStartUtcISO, prevUtcDay, todayInTz } from '../lib/time'
import { sendLive } from '../lib/live'
import { fireEffect } from '../lib/effects'
import type { Checkin } from '../types/db'
import { t } from '../lib/i18n'

/** 连续天数徽章:7🔥 / 30🏅 / 100💯 */
const badgeOf = (n: number) => (n >= 100 ? ' 💯' : n >= 30 ? ' 🏅' : n >= 7 ? ' 🔥' : '')

/** 从打卡日期集合算连续天数(今天没打就从昨天往前数);today 为共用时区下的今天 */
function streakOf(days: Set<string>, today: string): number {
  let cur = today
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
  dayTz,
  onToast,
  missEnabled = true,
  checkinEnabled = true,
}: {
  coupleId: string
  userId: string
  partnerName: string
  /** 两人共用的换日时区(决定「今天」) */
  dayTz: string
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
  const lastMissRef = useRef(0)
  // 想你 composer(可选表情 + 悄悄话)
  const [missOpen, setMissOpen] = useState(false)
  const [missEmoji, setMissEmoji] = useState('💭')
  const [missNote, setMissNote] = useState('')
  const [streakTheirs, setStreakTheirs] = useState(0)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<number> => {
    const today = todayInTz(dayTz)
    const [missRes, checkRes] = await Promise.all([
      supabase
        .from('misses')
        .select('user_id')
        .eq('couple_id', coupleId)
        .gte('created_at', dayStartUtcISO(dayTz)),
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
    let mineStreak = 0
    if (checkRes.data) {
      const rows = checkRes.data as Checkin[]
      const mine = new Set(rows.filter((r) => r.user_id === userId).map((r) => r.day))
      const theirs = new Set(rows.filter((r) => r.user_id !== userId).map((r) => r.day))
      setCheckedToday(mine.has(today))
      setTheirCheckedToday(theirs.has(today))
      mineStreak = streakOf(mine, today)
      setStreakMine(mineStreak)
      setStreakTheirs(streakOf(theirs, today))
    }
    return mineStreak
  }, [coupleId, userId, dayTz])

  useEffect(() => {
    void load()
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  /** 想你 +1(可附一个表情 + 一句悄悄话) */
  const handleMiss = async (emoji?: string, note?: string) => {
    if (busy) return
    // 节流:3 秒内只发一次,避免连点刷屏 misses 表
    if (Date.now() - lastMissRef.current < 3000) {
      onToast(t('慢一点~ TA 已经收到你的想念啦 💭'))
      return
    }
    lastMissRef.current = Date.now()
    setBusy(true)
    try {
      const trimmed = note?.trim() || null
      const em = emoji || '💭'
      const { error } = await supabase
        .from('misses')
        .insert({ couple_id: coupleId, user_id: userId, emoji: em, note: trimmed })
      if (error) throw error
      setMissMine((n) => n + 1)
      // 对方如果正开着 App,立刻收到想念卡片(带表情 + 悄悄话)
      sendLive('miss', { emoji: em, note: trimmed ?? '' })
      fireEffect([em, '💗'], 12)
      onToast(trimmed ? t('悄悄话已送到 TA 那儿 💌') : t('已经告诉 TA 你在想 TA 了 💭'))
      setMissOpen(false)
      setMissNote('')
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
        .insert({ couple_id: coupleId, user_id: userId, day: todayInTz(dayTz) })
      if (error) throw error
      // 用 reload 后的真实连胜值判断里程碑,而不是本地 streakMine+1(可能因竞态而错)
      const newStreak = await load()
      if ([7, 30, 100, 365, 520, 1000].includes(newStreak)) {
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
            onClick={() => setMissOpen(true)}
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
              name: t('TA'),
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
              name: t('TA'),
            })}
            {theirCheckedToday && t(' · TA 今天已打卡')}
          </>
        )}
      </p>

      {/* 想你 composer:居中卡片 + 深色遮罩,聚焦中间的想念卡片 */}
      {missOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-6"
          onClick={() => setMissOpen(false)}
        >
          <div
            className="modal-pop w-full max-w-sm rounded-3xl bg-white px-5 pb-5 pt-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-center text-base font-semibold text-primary-dark">
              {t('想 TA 了 💌')}
            </p>

            {/* 想念卡片预览 */}
            <div className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-rose-50 to-pink-100 px-4 py-5">
              <span className="text-5xl">{missEmoji}</span>
              <p className="mt-2 min-h-[1.25rem] text-center text-sm text-gray-600">
                {missNote.trim() || t('（悄悄话会显示在这里）')}
              </p>
            </div>

            {/* 表情选择 */}
            <div className="mt-4 grid grid-cols-8 gap-1.5">
              {['💭', '💗', '🥰', '😘', '🤗', '😢', '☕', '🌙', '🫶', '💌', '🥺', '😴', '🌈', '⭐', '🍀', '🐻'].map(
                (e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setMissEmoji(e)}
                    className={`flex aspect-square items-center justify-center rounded-xl text-xl transition-transform active:scale-90 ${
                      missEmoji === e ? 'scale-110 bg-soft ring-2 ring-primary' : 'bg-gray-50'
                    }`}
                  >
                    {e}
                  </button>
                ),
              )}
            </div>

            <input
              className="input mt-3 w-full py-2.5"
              type="text"
              maxLength={30}
              placeholder={t('悄悄话(可留空,直接发想念)')}
              value={missNote}
              onChange={(e) => setMissNote(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleMiss(missEmoji, missNote)}
              className="btn-primary mt-3 w-full rounded-full py-3 text-base disabled:opacity-60"
            >
              {missNote.trim() ? t('悄悄送给 TA') : t('发送想念')} {missEmoji}
            </button>
            <button
              type="button"
              onClick={() => setMissOpen(false)}
              className="mt-2 w-full py-2 text-center text-sm text-gray-400"
            >
              {t('取消')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
