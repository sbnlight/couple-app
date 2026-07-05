import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry, friendlyWriteError } from '../lib/net'
import type { Note } from '../types/db'
import { t } from '../lib/i18n'

/** 解锁时间快捷选项 */
const UNLOCK_OPTIONS = [
  { id: 'tomorrow', label: '明天此刻' },
  { id: '3days', label: '三天后' },
  { id: 'week', label: '一周后' },
  { id: 'custom', label: '自选时间' },
] as const

type UnlockOption = (typeof UNLOCK_OPTIONS)[number]['id']

function fmtTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 留言小纸条(全屏覆盖页)。
 * 写一张纸条设定开启时间;到点之前对方完全看不到内容
 * (数据库规则强制,只能看到"有 N 张待开启")。
 */
export default function NotesPage({
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
  const [notes, setNotes] = useState<Note[]>([])
  const [lockedCnt, setLockedCnt] = useState(0)
  const [nextUnlock, setNextUnlock] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [unlockOpt, setUnlockOpt] = useState<UnlockOption>('tomorrow')
  const [customTime, setCustomTime] = useState('')
  const [writing, setWriting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  // 对方改动提醒 + 编辑自己的纸条
  const [changedIds, setChangedIds] = useState<Set<number>>(new Set())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const load = useCallback(async () => {
    const [notesRes, lockedRes] = await Promise.all([
      // RLS 保证:自己写的全可见;对方写的只有解锁后才返回
      supabase
        .from('notes')
        .select('*')
        .eq('couple_id', coupleId)
        .order('id', { ascending: false })
        .limit(100),
      supabase.rpc('locked_notes_info', { cid: coupleId }),
    ])
    if (notesRes.data) {
      const rows = notesRes.data as Note[]
      setNotes(rows)
      // 对方改动提醒:TA 写的已解锁纸条 updated_at 比我上次看到的新 → 高亮
      const SEEN_KEY = `notes-seen-${coupleId}`
      const seen = localStorage.getItem(SEEN_KEY)
      const upAt = (n: Note) => (n as Note & { updated_at?: string | null }).updated_at ?? ''
      const partnerNotes = rows.filter((n) => n.author_id !== userId)
      const maxUp = partnerNotes.reduce((m, n) => (upAt(n) > m ? upAt(n) : m), '')
      if (seen === null) {
        // 首次打开:只建立基线、不点亮(否则 0023 给历史行补的 updated_at 会把 TA 每条旧纸条都误报为"刚改")
        localStorage.setItem(SEEN_KEY, maxUp)
      } else {
        const changed = new Set(partnerNotes.filter((n) => upAt(n) > seen).map((n) => n.id))
        // 无条件覆盖:回前台重拉后基线已追平、changed 为空时,横幅/红框高亮应随之清除,
        // 否则「TA 改动了 N 张」提示会一直滞留(只增不减)。
        setChangedIds(changed)
        if (changed.size > 0) localStorage.setItem(SEEN_KEY, maxUp > seen ? maxUp : seen)
      }
    }
    // 弱网超时:保留上次的待开启信息,不静默清零
    if (!lockedRes.error) {
      const info = (lockedRes.data as { cnt: number; next_unlock: string | null }[] | null)?.[0]
      setLockedCnt(Number(info?.cnt ?? 0))
      setNextUnlock(info?.next_unlock ?? null)
    }
    setLoading(false)
  }, [coupleId, userId])

  useEffect(() => {
    void load()
  }, [load])

  // 回前台时重拉一次:看到 TA 刚改动的纸条、以及到点新解锁的内容
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const computeUnlockAt = (): string | null => {
    const now = Date.now()
    const day = 86_400_000
    if (unlockOpt === 'tomorrow') return new Date(now + day).toISOString()
    if (unlockOpt === '3days') return new Date(now + 3 * day).toISOString()
    if (unlockOpt === 'week') return new Date(now + 7 * day).toISOString()
    if (!customTime) return null
    const t = new Date(customTime)
    return Number.isNaN(t.getTime()) || t.getTime() <= now ? null : t.toISOString()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    const unlockAt = computeUnlockAt()
    if (!content || !unlockAt || busy) return
    setBusy(true)
    setErr('')
    try {
      // 纸条无幂等键,插入只尝试一次以免写重复;失败给出提示而非静默丢弃(草稿保留)
      const { error } = await supabase.from('notes').insert({
        couple_id: coupleId,
        author_id: userId,
        content,
        unlock_at: unlockAt,
      })
      if (error) throw error
      setDraft('')
      setWriting(false)
      await load()
    } catch (e) {
      setErr(friendlyWriteError(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (n: Note) => {
    if (!window.confirm(t('撕掉这张纸条?'))) return
    setErr('')
    try {
      // 按 id 删除是幂等操作,弱网可安全重试
      await withRetry(async () => {
        const { error } = await supabase.from('notes').delete().eq('id', n.id)
        if (error) throw error
      })
      await load()
    } catch (e) {
      setErr(friendlyWriteError(e))
    }
  }

  /** 编辑自己写的纸条内容 */
  const saveNoteEdit = async (id: number) => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await withRetry(async () => {
        const { error } = await supabase.from('notes').update({ content: editDraft }).eq('id', id)
        if (error) throw error
      })
      setEditingId(null)
      await load()
    } catch (e) {
      setErr(friendlyWriteError(e))
    } finally {
      setBusy(false)
    }
  }

  const received = notes.filter((n) => n.author_id !== userId)
  const sent = notes.filter((n) => n.author_id === userId)

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-warmbg">
      <header className="flex items-center gap-2 border-b border-line bg-white/85 backdrop-blur-md px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="px-1 text-2xl text-gray-400">
          ‹
        </button>
        <h1 className="flex-1 text-base font-semibold text-primary-dark">{t('留言小纸条')}</h1>
        <button
          type="button"
          onClick={() => setWriting(true)}
          className="rounded-full bg-primary px-3 py-1.5 text-sm text-white"
        >
          {t('✍ 写纸条')}
        </button>
      </header>

      {err && !writing && (
        <p className="border-b border-line bg-red-50 px-4 py-2 text-center text-xs text-red-500">
          {err}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-300">{t('加载中…')}</p>
        ) : (
          <>
            {/* 待开启悬念 */}
            {lockedCnt > 0 && (
              <div className="love-milestone-glow mb-4 rounded-2xl border-2 border-dashed border-primary bg-soft p-4 text-center">
                <p className="text-sm text-primary-dark">
                  {t('🔒 {name}给你留了 {n} 张纸条还没到开启时间', {
                    name: partnerName,
                    n: lockedCnt,
                  })}
                </p>
                {nextUnlock && (
                  <p className="mt-1 text-xs text-gray-400">
                    {t('最近一张 {t} 开启', { t: fmtTime(nextUnlock) })}
                  </p>
                )}
              </div>
            )}

            {changedIds.size > 0 && (
              <div className="modal-pop mb-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-500 ring-1 ring-rose-100">
                💬 {t('{name} 改动了 {n} 张纸条,高亮的看看吧', { name: partnerName, n: changedIds.size })}
              </div>
            )}
            {/* 收到的(已解锁) */}
            {received.length > 0 && (
              <>
                <p className="mb-1.5 px-1 text-xs text-gray-400">{t('收到的纸条')}</p>
                {received.map((n) => (
                  <div
                    key={n.id}
                    className={`modal-pop mb-3 rounded-2xl bg-white p-4 ${changedIds.has(n.id) ? 'ring-2 ring-rose-300' : ''}`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.content}</p>
                    <p className="mt-2 text-xs text-gray-300">
                      {t('{name} · {a} 写下 · {b} 开启', {
                        name: partnerName,
                        a: fmtTime(n.created_at),
                        b: fmtTime(n.unlock_at),
                      })}
                    </p>
                  </div>
                ))}
              </>
            )}

            {/* 我写的 */}
            {sent.length > 0 && (
              <>
                <p className="mb-1.5 mt-2 px-1 text-xs text-gray-400">{t('我写的纸条')}</p>
                {sent.map((n) => {
                  const locked = new Date(n.unlock_at).getTime() > Date.now()
                  return (
                    <div key={n.id} className="mb-3 rounded-2xl bg-white p-4">
                      {editingId === n.id ? (
                        <div>
                          <textarea
                            className="input w-full resize-none"
                            rows={3}
                            maxLength={500}
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                          />
                          <div className="mt-1.5 flex gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void saveNoteEdit(n.id)}
                              className="btn-primary flex-1 rounded-full py-1.5 text-xs disabled:opacity-60"
                            >
                              {t('保存')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="flex-1 rounded-full border border-line py-1.5 text-xs text-gray-500"
                            >
                              {t('取消')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.content}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-300">
                        <span>
                          {locked
                            ? t('🔒 {t} 对 TA 开启', { t: fmtTime(n.unlock_at) })
                            : t('✅ TA 已可查看')}
                        </span>
                        <span className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(n.id)
                              setEditDraft(n.content)
                            }}
                            className="px-1"
                          >
                            {t('编辑')}
                          </button>
                          <button type="button" onClick={() => void remove(n)} className="px-1">
                            {t('撕掉')}
                          </button>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {received.length === 0 && sent.length === 0 && lockedCnt === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-gray-300">
                <span className="text-4xl">💌</span>
                <p className="text-sm">{t('写一张定时开启的小纸条,给 TA 一个惊喜吧')}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 写纸条弹层 */}
      {writing && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={() => setWriting(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-md rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
          >
            <p className="mb-3 text-center text-sm font-medium text-gray-500">
              {t('写给 {name}', { name: partnerName })}
            </p>
            <textarea
              className="input w-full resize-none"
              rows={4}
              maxLength={500}
              placeholder={t('写点想对 TA 说的话…')}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <p className="mt-3 text-sm font-medium text-gray-500">{t('何时开启')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {UNLOCK_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setUnlockOpt(o.id)}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    unlockOpt === o.id
                      ? 'bg-soft font-medium text-primary-dark'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {t(o.label)}
                </button>
              ))}
            </div>
            {unlockOpt === 'custom' && (
              <input
                className="input mt-2 w-full py-2"
                type="datetime-local"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
              />
            )}
            <button
              type="submit"
              disabled={busy || !draft.trim() || (unlockOpt === 'custom' && !computeUnlockAt())}
              className="btn-primary mt-4 w-full"
            >
              {busy ? t('封存中…') : t('封存纸条 💌')}
            </button>
            {err && <p className="mt-2 text-center text-xs text-red-500">{err}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
