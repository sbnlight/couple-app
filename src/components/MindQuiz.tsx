import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { todayInTz } from '../lib/time'
import { CountUp } from './Fx'
import { quizForDate, QUIZZES } from '../lib/quizzes'
import { fireEffect } from '../lib/effects'
import { withRetry, friendlyWriteError } from '../lib/net'
import { t } from '../lib/i18n'

interface QRow {
  quiz_date: string
  quiz_id: number
  user_id: string
  choice: number
  /** 选它的原因/悄悄话(双方都答完才互相可见) */
  note?: string | null
  /** 最后改动时间(0023 起),用于「对方改了留言」提醒 */
  updated_at?: string | null
}

/**
 * 默契双人问答(全屏页):每天一道选择题,两人各选一项,都答完揭晓是否默契。
 * 支持:查看历史 / 随时回去编辑自己往日的留言 / 对方改动后打开时高亮提示。
 * 揭晓在客户端做(答完才显示对方选择),服务端 RLS(0022)兜底「答完才可见对方」。
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
  const [today, setToday] = useState(() => todayInTz(dayTz))
  // 跨午夜自动换日:回前台/每分钟比对换日时区的日期,变了就刷新「今天」(load 依赖 today 会自动重载)
  useEffect(() => {
    const check = () => setToday((p) => (p === todayInTz(dayTz) ? p : todayInTz(dayTz)))
    const onVis = () => {
      if (!document.hidden) check()
    }
    document.addEventListener('visibilitychange', onVis)
    const timer = window.setInterval(check, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(timer)
    }
  }, [dayTz])
  const { quiz } = quizForDate(today)
  const [all, setAll] = useState<QRow[]>([]) // 所有行(今天 + 历史)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // 今日我的留言草稿(只在首次载入我的行时用服务端值初始化,之后由我控制,避免打字被 load 覆盖)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const noteInitRef = useRef(false)
  // 跨午夜换日时重置今日留言草稿:否则昨天的留言会残留在输入框(按钮还显示「已保存✓」),
  // 用户保存时会把昨天的留言写到今天的答案上。today 变了就清空并允许用新行重新初始化。
  const noteDayRef = useRef(today)
  useEffect(() => {
    if (noteDayRef.current === today) return
    noteDayRef.current = today
    noteInitRef.current = false
    setNoteDraft('')
    setNoteSaved(false)
  }, [today])
  // 对方改动提醒:哪些日期 TA 更新过(比我上次看到的新)
  const [changedDates, setChangedDates] = useState<Set<string>>(new Set())
  const [showHistory, setShowHistory] = useState(false)
  // 编辑历史某天我的留言
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const SEEN_KEY = `quiz-seen-${coupleId}`

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('quiz_answers')
      .select('quiz_date, quiz_id, user_id, choice, note, updated_at')
      .eq('couple_id', coupleId)
      .order('quiz_date', { ascending: false })
      .limit(730)
    // 弱网超时:保留已加载内容,别清空
    if (error) {
      console.warn('[MindQuiz load]', error)
      setLoading(false)
      return
    }
    const rows = (data as QRow[] | null) ?? []
    setAll(rows)
    setLoading(false)
    // 对方改动提醒:TA 的行 updated_at 比我上次看到的新 → 高亮那些日期(并把「已看到」推进到最新)
    const seen = localStorage.getItem(SEEN_KEY)
    const partnerRows = rows.filter((r) => r.user_id !== userId)
    const maxUp = partnerRows.reduce((m, r) => ((r.updated_at ?? '') > m ? r.updated_at! : m), '')
    if (seen === null) {
      // 首次打开:只建立基线、不点亮(否则 0023 给历史行补的 updated_at 会把 TA 每条旧留言都误报为"刚改")
      localStorage.setItem(SEEN_KEY, maxUp)
    } else {
      const changed = new Set(
        partnerRows.filter((r) => (r.updated_at ?? '') > seen).map((r) => r.quiz_date),
      )
      if (changed.size > 0) {
        setChangedDates(changed)
        localStorage.setItem(SEEN_KEY, maxUp > seen ? maxUp : seen)
      }
    }
  }, [coupleId, userId, SEEN_KEY])

  useEffect(() => {
    void load()
  }, [load])

  // 回前台时重拉一次:同一天里也能看到 TA 刚作答/改动的留言(异地场景关键)
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const rows = all.filter((r) => r.quiz_date === today)
  const mine = rows.find((r) => r.user_id === userId)
  const theirs = rows.find((r) => r.user_id !== userId)
  const bothAnswered = Boolean(mine && theirs)
  const matched = bothAnswered && mine!.choice === theirs!.choice

  // 按日期分组:既算默契值,也用于历史列表
  const byDate = new Map<string, QRow[]>()
  for (const r of all) {
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

  // 历史(我答过的往日,最新在前):可查看、可编辑我的留言
  const historyDays = [...byDate.entries()]
    .filter(([d]) => d < today)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => {
      const m = list.find((r) => r.user_id === userId)
      const th = list.find((r) => r.user_id !== userId)
      return { date, m, th, matched: Boolean(m && th && m.choice === th.choice) }
    })
    .filter((d) => d.m) // 只列我答过的天(才能编辑我的留言)

  /** upsert 某天的「选项 + 留言」(幂等);date 缺省今天 */
  const upsertAnswer = async (date: string, choice: number, note: string | null | undefined) => {
    const qid = quizForDate(date).id
    await withRetry(async () => {
      const payload: Record<string, unknown> = {
        couple_id: coupleId,
        quiz_date: date,
        quiz_id: qid,
        user_id: userId,
        choice,
      }
      if (note !== undefined) payload.note = note
      const { error } = await supabase
        .from('quiz_answers')
        .upsert(payload, { onConflict: 'couple_id,quiz_date,user_id' })
      if (error) throw error
    })
  }

  const answer = async (choice: number) => {
    if (busy) return
    setBusy(true)
    try {
      setErr('')
      await upsertAnswer(today, choice, undefined)
      await load()
    } catch (e) {
      setErr(friendlyWriteError(e))
    } finally {
      setBusy(false)
    }
  }

  // 首次拿到我的今日行时,用服务端已存的留言初始化草稿(仅一次)
  useEffect(() => {
    if (!noteInitRef.current && mine) {
      noteInitRef.current = true
      setNoteDraft(mine.note ?? '')
    }
  }, [mine])

  /** 保存今日留言(连当前选项一起 upsert) */
  const saveNote = async () => {
    if (busy || !mine) return
    setBusy(true)
    setErr('')
    try {
      await upsertAnswer(today, mine.choice, noteDraft.trim() || null)
      setNoteSaved(true)
      await load()
    } catch (e) {
      setErr(friendlyWriteError(e))
    } finally {
      setBusy(false)
    }
  }

  /** 保存历史某天我的留言 */
  const saveHistoryNote = async (date: string, choice: number) => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await upsertAnswer(date, choice, editDraft.trim() || null)
      setEditingDate(null)
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
        {/* 对方改动提醒 */}
        {changedDates.size > 0 && (
          <div className="modal-pop mb-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-500 ring-1 ring-rose-100">
            💬 {t('{name} 更新了 {n} 天的留言,下面高亮的看看吧', { name: partnerName, n: changedDates.size })}
          </div>
        )}

        <div className="rounded-2xl bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{t('今日一题 · {d}', { d: today })}</p>
            {rate !== null && (
              // 默契值环形仪表:conic 渐变环 + 中心滚动数字(静态可读,尊重减少动态)
              <div
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(var(--c-primary) ${rate * 3.6}deg, var(--c-line) 0deg)` }}
                title={t('默契值')}
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: 'var(--c-surface)' }}
                >
                  <span className="text-[11px] font-bold leading-none text-primary-dark">
                    <CountUp value={rate} suffix="%" />
                  </span>
                </div>
              </div>
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
                    } ${matched && iPicked ? 'today-glow' : ''}`}
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
          {/* 今日我的留言(答完选项后出现) */}
          {mine && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs text-gray-400">
                {t('说说你选它的原因(可选)· 双方都答完后 {name} 才能看到', { name: partnerName })}
              </p>
              <textarea
                className="input mt-2 w-full resize-none"
                rows={2}
                maxLength={200}
                placeholder={t('写点悄悄话…')}
                value={noteDraft}
                onChange={(e) => {
                  setNoteDraft(e.target.value)
                  setNoteSaved(false)
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveNote()}
                className="btn-primary mt-2 w-full rounded-full py-2 text-sm disabled:opacity-60"
              >
                {noteSaved ? t('已保存 ✓') : t('保存留言')}
              </button>
            </div>
          )}

          {/* 揭晓:双方都答完 → 显示对方的今日留言 */}
          {bothAnswered && theirs && (
            <div className="modal-pop mt-3 rounded-xl bg-soft p-3">
              <p className="text-xs text-gray-400">{t('{name}的留言', { name: partnerName })}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {theirs.note ? theirs.note : t('(TA 没有留言)')}
              </p>
            </div>
          )}

          {err && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-500">
              {err}
            </p>
          )}
        </div>

        {/* 历史:查看往日 + 编辑我的留言 */}
        {historyDays.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-sm text-gray-600"
            >
              <span>{t('📜 历史默契')}</span>
              <span className="text-xs text-gray-400">
                {showHistory ? t('收起') : t('展开 {n} 天', { n: historyDays.length })}
              </span>
            </button>

            {showHistory && (
              <div className="mt-2 space-y-2">
                {historyDays.map((d) => {
                  // 按作答时落库的 quiz_id 取题(而非用日期现算):题库增删/重排或两台设备
                  // 缓存到不同版本 bundle 时,现算会平移题号导致历史题文与选项对不上。
                  const q = QUIZZES[d.m!.quiz_id] ?? quizForDate(d.date).quiz
                  const changed = changedDates.has(d.date)
                  return (
                    <div
                      key={d.date}
                      className={`rounded-2xl bg-white p-4 ${changed ? 'ring-2 ring-rose-300' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400">{d.date}</p>
                        {changed && <span className="text-[10px] text-rose-400">{t('· TA 有更新')}</span>}
                        {d.matched && <span className="text-xs">💞</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium">{q.q}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('你')}:{q.options[d.m!.choice]}
                        {d.th && ` · ${partnerName}:${q.options[d.th.choice]}`}
                      </p>

                      {/* 我的留言(可编辑) */}
                      {editingDate === d.date ? (
                        <div className="mt-2">
                          <textarea
                            className="input w-full resize-none"
                            rows={2}
                            maxLength={200}
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                          />
                          <div className="mt-1.5 flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void saveHistoryNote(d.date, d.m!.choice)}
                              className="btn-primary flex-1 rounded-full py-1.5 text-xs disabled:opacity-60"
                            >
                              {t('保存')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDate(null)}
                              className="flex-1 rounded-full border border-line py-1.5 text-xs text-gray-500"
                            >
                              {t('取消')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-start justify-between gap-2 rounded-lg bg-soft px-2.5 py-1.5">
                          <p className="min-w-0 flex-1 whitespace-pre-wrap text-xs text-gray-600">
                            <span className="text-gray-400">{t('我的留言:')}</span>
                            {d.m!.note ? d.m!.note : t('(未写)')}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDate(d.date)
                              setEditDraft(d.m!.note ?? '')
                            }}
                            className="shrink-0 text-xs text-primary-dark"
                          >
                            {t('✏️ 编辑')}
                          </button>
                        </div>
                      )}

                      {/* TA 的留言 */}
                      {d.th && (
                        <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-rose-50/60 px-2.5 py-1.5 text-xs text-gray-600">
                          <span className="text-gray-400">{t('{name}的留言:', { name: partnerName })}</span>
                          {d.th.note ? d.th.note : t('(没有留言)')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <p className="mt-4 px-1 text-xs text-gray-300">
          {t('题库共 {n} 题,每天一道循环;答案与留言都可随时回去改', { n: QUIZZES.length })}
        </p>
      </div>
    </div>
  )
}
