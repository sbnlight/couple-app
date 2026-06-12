import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currencySymbol } from '../hooks/useExpenses'
import { prevUtcDay } from '../lib/time'
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

  const slide = 'flex h-full snap-start flex-col items-center justify-center gap-4 px-10 text-center'
  const big = 'text-5xl font-bold text-primary-dark'
  const label = 'text-sm text-gray-500 leading-relaxed'

  const msgsTheirs = stats ? stats.msgsTotal - stats.msgsMine : 0
  const talker =
    stats && stats.msgsTotal > 0
      ? stats.msgsMine >= msgsTheirs
        ? myName
        : partnerName
      : null

  const fmtMoneyMap = (m: Map<string, number>) =>
    [...m.entries()].map(([c, v]) => `${currencySymbol(c)}${v.toFixed(0)}`).join(' + ')

  return (
    <div className="fixed inset-0 z-50 mx-auto h-full max-w-md snap-y snap-mandatory overflow-y-auto bg-warmbg">
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/15 text-white"
        aria-label="关闭"
      >
        ✕
      </button>

      {!stats ? (
        <div className={slide}>
          <span className="animate-pulse text-4xl">📊</span>
          <p className={label}>{t('正在为你们整理这一年…')}</p>
        </div>
      ) : (
        <>
          {/* 封面 */}
          <section
            className={slide}
            style={{ background: 'linear-gradient(165deg, #fff1f2, #ffe4e6 55%, #fce7f3)' }}
          >
            <span className="text-6xl">❤️</span>
            <p className="text-3xl font-bold text-primary-dark">{t('我们的 {y}', { y: year })}</p>
            <p className={label}>{t('这是我们在一起的第 {n} 天', { n: stats.days })}</p>
            <p className="mt-8 animate-bounce text-xs text-gray-400">{t('上滑查看 ↓')}</p>
          </section>

          {/* 聊天 */}
          <section
            className={slide}
            style={{ background: 'linear-gradient(165deg, #fef3c7, #ffe4e6)' }}
          >
            <p className={label}>{t('这一年,我们说了')}</p>
            <p className={big}>{stats.msgsTotal}</p>
            <p className={label}>
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
              <p className="rounded-full bg-white/70 px-4 py-1.5 text-sm text-primary-dark">
                {t('🏆 年度话痨担当:{name}', { name: talker })}
              </p>
            )}
          </section>

          {/* 互动 */}
          <section
            className={slide}
            style={{ background: 'linear-gradient(165deg, #e0f2fe, #fce7f3)' }}
          >
            <p className={label}>{t('想念发生了')}</p>
            <p className={big}>{stats.missMine + stats.missTheirs}</p>
            <p className={label}>
              {t('次')}
              <br />
              {t('{me}想了 {a} 次 · {ta}想了 {b} 次', {
                me: myName,
                a: stats.missMine,
                ta: partnerName,
                b: stats.missTheirs,
              })}
            </p>
            <p className={label}>
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
            className={slide}
            style={{ background: 'linear-gradient(165deg, #dcfce7, #fef9c3)' }}
          >
            <p className={label}>{t('我们一起记下了')}</p>
            <p className={big}>{stats.expenseCount}</p>
            <p className={label}>
              {t('笔生活的痕迹')}
              <br />
              {stats.expense.size > 0 && (
                <>
                  {t('支出 {s}', { s: fmtMoneyMap(stats.expense) })}
                  <br />
                </>
              )}
              {stats.income.size > 0 && <>{t('收入 {s}', { s: fmtMoneyMap(stats.income) })}</>}
            </p>
          </section>

          {/* 愿望与尾声 */}
          <section
            className={slide}
            style={{ background: 'linear-gradient(165deg, #ede9fe, #ffe4e6)' }}
          >
            <span className="text-5xl">🌠</span>
            <p className={label}>
              {t('愿望清单实现了 {a}/{b} 个', { a: stats.wishesDone, b: stats.wishesTotal })}
              <br />
              {t('留下了 {n} 张小纸条', { n: stats.notes })}
            </p>
            <p className="mt-6 text-lg font-semibold text-primary-dark">
              {t('新的一年,继续把日子过成诗 ❤')}
            </p>
          </section>
        </>
      )}
    </div>
  )
}
