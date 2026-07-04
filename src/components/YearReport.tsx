import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import { currencySymbol } from '../hooks/useExpenses'
import { prevUtcDay } from '../lib/time'
import { fireEffect } from '../lib/effects'
import { CountUp, FloatLayer } from './Fx'
import { t } from '../lib/i18n'

interface Stats {
  days: number
  msgsTotal: number
  msgsMine: number
  imgs: number
  missMine: number
  missTheirs: number
  streakMine: number
  streakTheirs: number
  checkinsTotal: number
  expense: Map<string, number>
  income: Map<string, number>
  expenseCount: number
  wishesDone: number
  wishesTotal: number
  notes: number
}

/** 一串日期里的最长连续天数 */
function maxStreak(days: string[]): number {
  const set = new Set(days)
  let best = 0
  for (const d of set) {
    if (set.has(prevUtcDay(d))) continue // 不是一段连续的起点
    let len = 1
    let cur = d
    for (;;) {
      const next = new Date(Date.parse(`${cur}T00:00:00Z`) + 86_400_000)
        .toISOString()
        .slice(0, 10)
      if (!set.has(next)) break
      len++
      cur = next
    }
    best = Math.max(best, len)
  }
  return best
}

/**
 * 「我们的{年份}」年度报告:上下滑动翻页的仪式感统计。
 */
export default function YearReport({
  coupleId,
  userId,
  myName,
  partnerName,
  coupleCreatedAt,
  onClose,
}: {
  coupleId: string
  userId: string
  myName: string
  partnerName: string
  coupleCreatedAt: string
  onClose: () => void
}) {
  const year = new Date().getFullYear()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const startISO = `${year}-01-01T00:00:00Z`
    const startDate = `${year}-01-01`
    void (async () => {
      const base = () =>
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('couple_id', coupleId)
          .gte('created_at', startISO)
      const [
        msgsTotalRes,
        msgsMineRes,
        imgsRes,
        missMineRes,
        missTheirsRes,
        checkinsRes,
        expensesRes,
        wishesRes,
        notesRes,
      ] = await Promise.all([
        base(),
        base().eq('sender_id', userId),
        base().eq('type', 'image'),
        supabase
          .from('misses')
          .select('id', { count: 'exact', head: true })
          .eq('couple_id', coupleId)
          .gte('created_at', startISO)
          .eq('user_id', userId),
        supabase
          .from('misses')
          .select('id', { count: 'exact', head: true })
          .eq('couple_id', coupleId)
          .gte('created_at', startISO)
          .neq('user_id', userId),
        supabase
          .from('checkins')
          .select('user_id, day')
          .eq('couple_id', coupleId)
          .gte('day', startDate),
        supabase
          .from('expenses')
          .select('amount, kind, currency')
          .eq('couple_id', coupleId)
          .gte('spent_at', startDate),
        supabase.from('wishes').select('done').eq('couple_id', coupleId),
        supabase
          .from('notes')
          .select('id', { count: 'exact', head: true })
          .eq('couple_id', coupleId)
          .gte('created_at', startISO),
      ])

      const checkins = (checkinsRes.data as { user_id: string; day: string }[] | null) ?? []
      const mineDays = checkins.filter((c) => c.user_id === userId).map((c) => c.day)
      const theirDays = checkins.filter((c) => c.user_id !== userId).map((c) => c.day)

      const expense = new Map<string, number>()
      const income = new Map<string, number>()
      let expenseCount = 0
      for (const e of (expensesRes.data as
        | { amount: number; kind: string; currency: string }[]
        | null) ?? []) {
        const target = e.kind === 'income' ? income : expense
        target.set(e.currency, (target.get(e.currency) ?? 0) + Number(e.amount))
        if (e.kind === 'expense') expenseCount++
      }

      const wishes = (wishesRes.data as { done: boolean }[] | null) ?? []

      setStats({
        days:
          Math.floor((Date.now() - new Date(coupleCreatedAt).getTime()) / 86_400_000) + 1,
        msgsTotal: msgsTotalRes.count ?? 0,
        msgsMine: msgsMineRes.count ?? 0,
        imgs: imgsRes.count ?? 0,
        missMine: missMineRes.count ?? 0,
        missTheirs: missTheirsRes.count ?? 0,
        streakMine: maxStreak(mineDays),
        streakTheirs: maxStreak(theirDays),
        checkinsTotal: checkins.length,
        expense,
        income,
        expenseCount,
        wishesDone: wishes.filter((w) => w.done).length,
        wishesTotal: wishes.length,
        notes: notesRes.count ?? 0,
      })
    })()
  }, [coupleId, userId, year, coupleCreatedAt])

  const containerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]))
  const LAST = 4

  // 滚到哪一页:触发数字滚动 + 逐行渐入;首末页撒花
  useEffect(() => {
    if (!stats) return
    const root = containerRef.current
    if (!root) return
    const sections = root.querySelectorAll('section[data-idx]')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.idx)
            setActive(idx)
            setSeen((prev) => {
              if (prev.has(idx)) return prev
              if (idx === 0 || idx === LAST) fireEffect(['🎉', '🎊', '💕', '✨'], 36)
              return new Set(prev).add(idx)
            })
          }
        }
      },
      { root, threshold: [0.6] },
    )
    sections.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [stats])

  const label = 'text-sm leading-relaxed text-white/90'
  const big =
    'year-num text-7xl font-extrabold text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.18)]'
  const slide =
    'relative flex h-full snap-start snap-always flex-col items-center justify-center gap-4 overflow-hidden px-10 text-center'
  /** 逐行渐入:进入该页才播,带阶梯延迟 */
  const reveal = (idx: number, i: number): { className: string; style: CSSProperties } =>
    seen.has(idx)
      ? { className: 'year-rise', style: { animationDelay: `${0.1 + i * 0.13}s` } }
      : { className: 'opacity-0', style: {} }
  const glass = 'rounded-2xl border border-white/40 bg-white/25 px-4 py-2 backdrop-blur-md'

  const msgsTheirs = stats ? stats.msgsTotal - stats.msgsMine : 0
  const talker =
    stats && stats.msgsTotal > 0 ? (stats.msgsMine >= msgsTheirs ? myName : partnerName) : null
  const fmtMoneyMap = (m: Map<string, number>) =>
    [...m.entries()].map(([c, v]) => `${currencySymbol(c)}${v.toFixed(0)}`).join(' + ')

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 mx-auto h-full max-w-md snap-y snap-mandatory overflow-y-auto"
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm"
        aria-label="关闭"
      >
        ✕
      </button>

      {/* 侧边进度点 */}
      {stats && (
        <div className="fixed right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full bg-white transition-all duration-300 ${
                active === i ? 'h-4 opacity-100' : 'w-1.5 opacity-40'
              }`}
              style={{ width: 6 }}
            />
          ))}
        </div>
      )}

      {!stats ? (
        <div
          className={slide}
          style={{ background: 'linear-gradient(165deg, #fb7185, #db2777)' }}
        >
          <span className="year-pulse text-5xl">📊</span>
          <p className={label}>{t('正在为你们整理这一年…')}</p>
        </div>
      ) : (
        <>
          {/* 封面 */}
          <section
            data-idx="0"
            className={slide}
            style={{ background: 'linear-gradient(165deg, #fb7185, #e11d48 60%, #9d174d)' }}
          >
            <FloatLayer items={['❤️', '💕', '✨', '💖', '🎊']} />
            <span className="year-pulse text-7xl drop-shadow-lg">❤️</span>
            <p {...reveal(0, 1)} className={`${reveal(0, 1).className} text-4xl font-extrabold text-white drop-shadow`}>
              {t('我们的 {y}', { y: year })}
            </p>
            <p {...reveal(0, 2)} className={`${reveal(0, 2).className} ${label}`}>
              {t('这是我们在一起的第 {n} 天', { n: stats.days })}
            </p>
            <p className="absolute bottom-12 animate-bounce text-xs text-white/80">
              {t('上滑查看 ↓')}
            </p>
          </section>

          {/* 聊天 */}
          <section
            data-idx="1"
            className={slide}
            style={{ background: 'linear-gradient(165deg, #fbbf24, #fb923c 55%, #db2777)' }}
          >
            <FloatLayer items={['💬', '💌', '🗨️', '✨']} />
            <p {...reveal(1, 0)} className={`${reveal(1, 0).className} ${label}`}>
              {t('这一年,我们说了')}
            </p>
            <p className={big}>
              <CountUp value={stats.msgsTotal} run={seen.has(1)} />
            </p>
            <p {...reveal(1, 2)} className={`${reveal(1, 2).className} ${label}`}>
              {t('条悄悄话')}
              <br />
              {t('{me} {a} 条 · {ta} {b} 条', {
                me: myName,
                a: stats.msgsMine,
                ta: partnerName,
                b: msgsTheirs,
              })}
              <br />
              {t('还有 {n} 张照片的瞬间', { n: stats.imgs })}
            </p>
            {talker && (
              <p {...reveal(1, 3)} className={`${reveal(1, 3).className} ${glass} text-sm font-medium text-white`}>
                {t('🏆 年度话痨担当:{name}', { name: talker })}
              </p>
            )}
          </section>

          {/* 互动 */}
          <section
            data-idx="2"
            className={slide}
            style={{ background: 'linear-gradient(165deg, #38bdf8, #6366f1 60%, #a21caf)' }}
          >
            <FloatLayer items={['💭', '💗', '📍', '🔥']} />
            <p {...reveal(2, 0)} className={`${reveal(2, 0).className} ${label}`}>
              {t('想念发生了')}
            </p>
            <p className={big}>
              <CountUp value={stats.missMine + stats.missTheirs} run={seen.has(2)} />
            </p>
            <p {...reveal(2, 2)} className={`${reveal(2, 2).className} ${label}`}>
              {t('次')}
              <br />
              {t('{me}想了 {a} 次 · {ta}想了 {b} 次', {
                me: myName,
                a: stats.missMine,
                ta: partnerName,
                b: stats.missTheirs,
              })}
            </p>
            <p {...reveal(2, 3)} className={`${reveal(2, 3).className} ${glass} ${label}`}>
              {t('打卡共 {n} 天', { n: stats.checkinsTotal })}
              <br />
              {t('最长连续:{me} {a} 天 · {ta} {b} 天', {
                me: myName,
                a: stats.streakMine,
                ta: partnerName,
                b: stats.streakTheirs,
              })}
            </p>
          </section>

          {/* 记账 */}
          <section
            data-idx="3"
            className={slide}
            style={{ background: 'linear-gradient(165deg, #34d399, #0d9488 60%, #f59e0b)' }}
          >
            <FloatLayer items={['💰', '🧾', '✨', '🪙']} />
            <p {...reveal(3, 0)} className={`${reveal(3, 0).className} ${label}`}>
              {t('我们一起记下了')}
            </p>
            <p className={big}>
              <CountUp value={stats.expenseCount} run={seen.has(3)} />
            </p>
            <p {...reveal(3, 2)} className={`${reveal(3, 2).className} ${label}`}>
              {t('笔生活的痕迹')}
            </p>
            {(stats.expense.size > 0 || stats.income.size > 0) && (
              <p {...reveal(3, 3)} className={`${reveal(3, 3).className} ${glass} ${label}`}>
                {stats.expense.size > 0 && (
                  <>
                    {t('支出 {s}', { s: fmtMoneyMap(stats.expense) })}
                    {stats.income.size > 0 && <br />}
                  </>
                )}
                {stats.income.size > 0 && <>{t('收入 {s}', { s: fmtMoneyMap(stats.income) })}</>}
              </p>
            )}
          </section>

          {/* 愿望与尾声 */}
          <section
            data-idx="4"
            className={slide}
            style={{ background: 'linear-gradient(165deg, #a78bfa, #7c3aed 55%, #db2777)' }}
          >
            <FloatLayer items={['🌠', '⭐', '💫', '💕', '🎊']} />
            <span {...reveal(4, 0)} className={`${reveal(4, 0).className} year-pulse text-6xl drop-shadow`}>
              🌠
            </span>
            <p {...reveal(4, 1)} className={`${reveal(4, 1).className} ${glass} ${label}`}>
              {t('愿望清单实现了 {a}/{b} 个', { a: stats.wishesDone, b: stats.wishesTotal })}
              <br />
              {t('留下了 {n} 张小纸条', { n: stats.notes })}
            </p>
            <p {...reveal(4, 2)} className={`${reveal(4, 2).className} mt-6 text-xl font-bold text-white drop-shadow`}>
              {t('新的一年,继续把日子过成诗 ❤')}
            </p>
          </section>
        </>
      )}
    </div>
  )
}
