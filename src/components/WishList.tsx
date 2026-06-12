import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Wish } from '../types/db'

/** 愿望清单(全屏覆盖页):两人共同的 bucket list,都可添加/打勾/删除 */
export default function WishList({
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
  const [wishes, setWishes] = useState<Wish[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('wishes')
      .select('*')
      .eq('couple_id', coupleId)
      .order('done', { ascending: true })
      .order('id', { ascending: false })
    if (!error && data) setWishes(data as Wish[])
    setLoading(false)
  }, [coupleId])

  useEffect(() => {
    void load()
  }, [load])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || busy) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('wishes')
        .insert({ couple_id: coupleId, creator_id: userId, content })
      if (error) throw error
      setDraft('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (w: Wish) => {
    const { error } = await supabase
      .from('wishes')
      .update({ done: !w.done, done_at: w.done ? null : new Date().toISOString() })
      .eq('id', w.id)
    if (!error) await load()
  }

  const remove = async (w: Wish) => {
    if (!window.confirm('删除这个愿望?')) return
    const { error } = await supabase.from('wishes').delete().eq('id', w.id)
    if (!error) await load()
  }

  const pending = wishes.filter((w) => !w.done)
  const done = wishes.filter((w) => w.done)

  const renderItem = (w: Wish) => (
    <div key={w.id} className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={() => void toggle(w)}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm ${
          w.done ? 'border-primary bg-primary text-white' : 'border-line'
        }`}
        aria-label={w.done ? '标记为未完成' : '标记为完成'}
      >
        {w.done && '✓'}
      </button>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-sm ${w.done ? 'text-gray-300 line-through' : ''}`}
        >
          {w.content}
        </span>
        <span className="block text-xs text-gray-300">
          {w.creator_id === userId ? '我' : partnerName}许的愿
        </span>
      </span>
      <button type="button" onClick={() => void remove(w)} className="px-1 text-gray-300">
        ✕
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-warmbg">
      <header className="flex items-center gap-2 border-b border-line bg-white px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="px-1 text-2xl text-gray-400">
          ‹
        </button>
        <h1 className="text-base font-semibold text-primary-dark">愿望清单</h1>
      </header>

      {/* 添加 */}
      <form onSubmit={handleAdd} className="flex gap-2 border-b border-line bg-white px-4 py-3">
        <input
          className="input min-w-0 flex-1 py-2"
          type="text"
          placeholder="想一起做的事,比如:去看极光"
          maxLength={60}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={busy || !draft.trim()} className="btn-primary px-4 py-2">
          许愿
        </button>
      </form>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-300">加载中…</p>
        ) : wishes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-300">
            <span className="text-4xl">🌠</span>
            <p className="text-sm">还没有愿望,写下你们想一起做的事吧</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="divide-y divide-line rounded-2xl bg-white px-4">
                {pending.map(renderItem)}
              </div>
            )}
            {done.length > 0 && (
              <>
                <p className="mb-1.5 mt-4 px-1 text-xs text-gray-400">
                  已实现 {done.length} 个 🎉
                </p>
                <div className="divide-y divide-line rounded-2xl bg-white px-4">
                  {done.map(renderItem)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
