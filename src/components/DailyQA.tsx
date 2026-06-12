import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { questionForDate } from '../lib/questions'
import { utcToday } from '../lib/time'
import type { DailyAnswer } from '../types/db'

/**
 * 每日一问(全屏覆盖页)。
 * 规则:回答完当天的问题,才能看到对方的答案(数据库强制)。
 */
export default function DailyQA({
  coupleId,
  userId,
  partnerName,
  onClose,
}: {
  coupleId: string
  userId: string
  partnerName: string
  onClose: () => void
}) {
  const today = utcToday()
  const question = questionForDate(today)
  const [draft, setDraft] = useState('')
  const [mine, setMine] = useState<DailyAnswer | null>(null)
  const [theirs, setTheirs] = useState<DailyAnswer | null>(null)
  const [theyAnswered, setTheyAnswered] = useState(false)
  const [history, setHistory] = useState<DailyAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    const [todayRes, partnerRes, histRes] = await Promise.all([
      supabase
        .from('daily_answers')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('question_date', today),
      supabase.rpc('partner_answered', { cid: coupleId, qdate: today }),
      supabase
        .from('daily_answers')
        .select('*')
        .eq('couple_id', coupleId)
        .lt('question_date', today)
        .order('question_date', { ascending: false })
        .limit(40),
    ])
    const rows = (todayRes.data as DailyAnswer[] | null) ?? []
    setMine(rows.find((r) => r.user_id === userId) ?? null)
    setTheirs(rows.find((r) => r.user_id !== userId) ?? null)
    setTheyAnswered(Boolean(partnerRes.data))
    setHistory((histRes.data as DailyAnswer[] | null) ?? [])
    setLoading(false)
  }, [coupleId, userId, today])

  useEffect(() => {
    void load()
  }, [load])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || busy) return
    setBusy(true)
    try {
      if (mine && editing) {
        const { error } = await supabase
          .from('daily_answers')
          .update({ content })
          .eq('id', mine.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('daily_answers').insert({
          couple_id: coupleId,
          user_id: userId,
          question_date: today,
          content,
        })
        if (error) throw error
      }
      setDraft('')
      setEditing(false)
      await load() // 答完即可看到对方的答案
    } catch {
      // 失败保留草稿,提示在按钮上体现
    } finally {
      setBusy(false)
    }
  }

  // 往期按日期归并
  const historyByDate = new Map<string, DailyAnswer[]>()
  for (const a of history) {
    const list = historyByDate.get(a.question_date)
    if (list) list.push(a)
    else historyByDate.set(a.question_date, [a])
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-warmbg">
      <header className="flex items-center gap-2 border-b border-line bg-white/85 backdrop-blur-md px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="px-1 text-2xl text-gray-400">
          ‹
        </button>
        <h1 className="text-base font-semibold text-primary-dark">每日一问</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* 今日问题 */}
        <div className="rounded-2xl bg-white p-5">
          <p className="text-xs text-gray-400">今日问题 · {today}</p>
          <p className="mt-2 text-base font-medium leading-relaxed">{question}</p>

          {loading ? (
            <p className="mt-4 text-sm text-gray-300">加载中…</p>
          ) : mine && !editing ? (
            <>
              <div className="mt-4 rounded-xl bg-soft p-3">
                <p className="text-xs text-gray-400">我的回答</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{mine.content}</p>
                <button
                  type="button"
                  className="mt-1 text-xs text-gray-400 underline"
                  onClick={() => {
                    setDraft(mine.content)
                    setEditing(true)
                  }}
                >
                  修改
                </button>
              </div>
              <div className="mt-3 rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-400">{partnerName}的回答</p>
                {theirs ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm">{theirs.content}</p>
                ) : (
                  <p className="mt-1 text-sm text-gray-300">TA 还没回答,耐心等等~</p>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4">
              <textarea
                className="input w-full resize-none"
                rows={3}
                maxLength={500}
                placeholder="写下你的回答…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <p className="mt-2 text-xs text-gray-400">
                {theyAnswered
                  ? `${partnerName}已经回答了,写下你的答案就能看到 👀`
                  : `${partnerName}还没回答;你答完后,TA 的答案一出来就能看到`}
              </p>
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="btn-primary mt-3 w-full"
              >
                {busy ? '提交中…' : editing ? '保存修改' : '提交回答'}
              </button>
            </form>
          )}
        </div>

        {/* 往期回顾 */}
        {historyByDate.size > 0 && (
          <div className="mt-4">
            <p className="mb-2 px-1 text-xs text-gray-400">往期回顾</p>
            {[...historyByDate.entries()].map(([date, answers]) => (
              <div key={date} className="mb-3 rounded-2xl bg-white p-4">
                <p className="text-xs text-gray-400">{date}</p>
                <p className="mt-1 text-sm font-medium">{questionForDate(date)}</p>
                {answers.map((a) => (
                  <p key={a.id} className="mt-2 text-sm">
                    <span className="text-gray-400">
                      {a.user_id === userId ? '我' : partnerName}:
                    </span>
                    {a.content}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
