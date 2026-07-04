import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayInTz } from '../lib/time'
import { quizForDate, QUIZZES } from '../lib/quizzes'
import { fireEffect } from '../lib/effects'
import { withRetry, friendlyWriteError } from '../lib/net'
import { t } from '../lib/i18n'

interface QRow {
  quiz_date: string
  quiz_id: number
  user_id: string
  choice: number
}

/**
 * 默契双人问答(全屏页):每天一道选择题,两人各选一项,都答完揭晓是否默契。
 * 揭晓在客户端做(答完才显示对方选择);数据存 quiz_answers(RLS 限本小屋成员)。
 */
export default function MindQuiz({
  coupleId,
  userId,
  partnerName,
  dayTz,
  onClose,
}: {
  coupleId: string
  userId: string
  partnerName: string
  dayTz: string
  onClose: () => void
}) {
  const today = todayInTz(dayTz)
  const { id: quizId, quiz } = quizForDate(today)
  const [rows, setRows] = useState<QRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // 全部历史(算默契值)
  const [history, setHistory] = useState<QRow[]>([])

  const load = useCallback(async () => {
    const [todayRes, allRes] = await Promise.all([
      supabase
        .from('quiz_answers')
        .select('quiz_date, quiz_id, user_id, choice')
        .eq('couple_id', coupleId)
        .eq('quiz_date', today),
      supabase
        .from('quiz_answers')
        .select('quiz_date, quiz_id, user_id, choice')
        .eq('couple_id', coupleId),
    ])
    // 弱网超时:保留已加载的答案,别清空成「未作答」(否则刚提交的答案会瞬间消失)
    if (todayRes.error || allRes.error) {
      console.warn('[MindQuiz load]', todayRes.error ?? allRes.error)
      setLoading(false)
      return
    }
    setRows((todayRes.data as QRow[] | null) ?? [])
    setHistory((allRes.data as QRow[] | null) ?? [])
    setLoading(false)
  }, [coupleId, today])

  useEffect(() => {
    void load()
  }, [load])

  const mine = rows.find((r) => r.user_id === userId)
  const theirs = rows.find((r) => r.user_id !== userId)
  const bothAnswered = Boolean(mine && theirs)
  const matched = bothAnswered && mine!.choice === theirs!.choice

  // 默契值:历史里两人都答过的日期中,选择相同的比例
  const byDate = new Map<string, QRow[]>()
  for (const r of history) {
    const list = byDate.get(r.quiz_date)
    if (list) list.push(r)
    else byDate.set(r.quiz_date, [r])
  }
  let bothDays = 0
  let matchDays = 0
  for (const [, list] of byDate) {
    const a = list.find((r) => r.user_id === userId)
    const b = list.find((r) => r.user_id !== userId)
    if (a && b) {
      bothDays++
      if (a.choice === b.choice) matchDays++
    }
  }
  const rate = bothDays > 0 ? Math.round((matchDays / bothDays) * 100) : null

  const answer = async (choice: number) => {
    if (busy) return
    setBusy(true)
    try {
      setErr('')
      // 幂等 upsert(onConflict),弱网可安全重试;真报错(如迁移漏跑)会如实抛出
      await withRetry(async () => {
        const { error } = await supabase.from('quiz_answers').upsert(
          { couple_id: coupleId, quiz_date: today, quiz_id: quizId, user_id: userId, choice },
          { onConflict: 'couple_id,quiz_date,user_id' },
        )
        if (error) throw error
      })
      await load()
    } catch (e) {
      setErr(friendlyWriteError(e))
    } finally {
      setBusy(false)
    }
  }

  // 双方都答完且默契 → 撒花(每天每设备一次)
  useEffect(() => {
    if (matched) {
      const key = `quiz-fx-${today}`
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        fireEffect(['💞', '🎯', '✨'], 30)
      }
    }
  }, [matched, today])

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-warmbg">
      <header className="flex items-center gap-2 border-b border-line bg-white/85 backdrop-blur-md px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="px-1 text-2xl text-gray-400">
          ‹
        </button>
        <h1 className="text-base font-semibold text-primary-dark">{t('默契大考验')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-2xl bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{t('今日一题 · {d}', { d: today })}</p>
            {rate !== null && (
              <span className="rounded-full bg-soft px-2 py-0.5 text-xs text-primary-dark">
                {t('默契 {n}%', { n: rate })}
              </span>
            )}
          </div>
          <p className="mt-2 text-base font-medium leading-relaxed">{quiz.q}</p>

          {loading ? (
            <p className="mt-4 text-sm text-gray-300">{t('加载中…')}</p>
          ) : (
            <div className="mt-4 space-y-2">
              {quiz.options.map((opt, i) => {
                const iPicked = mine?.choice === i
                const theyPicked = bothAnswered && theirs?.choice === i
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={busy}
                    onClick={() => void answer(i)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                      iPicked
                        ? 'border-primary bg-soft font-medium text-primary-dark'
                        : 'border-line'
                    }`}
                  >
                    <span>{opt}</span>
                    <span className="flex gap-1 text-xs">
                      {iPicked && <span className="text-primary-dark">{t('你')}</span>}
                      {theyPicked && <span className="text-rose-400">{partnerName}</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {!loading && (
            <p className="mt-3 text-center text-sm">
              {!mine
                ? t('选一个,看看和 {name} 默不默契', { name: partnerName })
                : !theirs
                  ? t('已提交,等 {name} 作答…', { name: partnerName })
                  : matched
                    ? t('心有灵犀!你们选了一样 💞')
                    : t('这次没选到一起,聊聊为什么呀~')}
            </p>
          )}
          {err && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-500">
              {err}
            </p>
          )}
        </div>

        <p className="mt-4 px-1 text-xs text-gray-300">
          {t('题库共 {n} 题,每天一道循环;可以随时改答案', { n: QUIZZES.length })}
        </p>
      </div>
    </div>
  )
}
