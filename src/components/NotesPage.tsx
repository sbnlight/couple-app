import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
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
    if (notesRes.data) setNotes(notesRes.data as Note[])
    const info = (lockedRes.data as { cnt: number; next_unlock: string | null }[] | null)?.[0]
    setLockedCnt(Number(info?.cnt ?? 0))
    setNextUnlock(info?.next_unlock ?? null)
    setLoading(false)
  }, [coupleId])

  useEffect(() => {
    void load()
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
    try {
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
    } finally {
      setBusy(false)
    }
  }

  const remove = async (n: Note) => {
    if (!window.confirm(t('撕掉这张纸条?'))) return
    const { error } = await supabase.from('notes').delete().eq('id', n.id)
    if (!error) await load()
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

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-300">{t('加载中…')}</p>
        ) : (
          <>
            {/* 待开启悬念 */}
            {lockedCnt > 0 && (
              <div className="mb-4 rounded-2xl border-2 border-dashed border-primary bg-soft p-4 text-center">
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

            {/* 收到的(已解锁) */}
            {received.length > 0 && (
              <>
                <p className="mb-1.5 px-1 text-xs text-gray-400">{t('收到的纸条')}</p>
                {received.map((n) => (
                  <div key={n.id} className="mb-3 rounded-2xl bg-white p-4">
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
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.content}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-300">
                        <span>
                          {locked
                            ? t('🔒 {t} 对 TA 开启', { t: fmtTime(n.unlock_at) })
                            : t('✅ TA 已可查看')}
                        </span>
                        <button type="button" onClick={() => void remove(n)} className="px-1">
                          {t('撕掉')}
                        </button>
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
          </form>
        </div>
      )}
    </div>
  )
}
