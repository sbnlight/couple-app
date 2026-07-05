import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry, friendlyWriteError } from '../lib/net'
import { fireEffect } from '../lib/effects'
import { FloatLayer } from './Fx'
import type { Gratitude } from '../types/db'
import { t } from '../lib/i18n'

/** 起个头的小模板,点一下填进输入框 */
const TEMPLATES = ['谢谢你，', '今天好喜欢你，因为', '想夸夸你：', '有你真好，', '最近你让我很感动的是']

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/**
 * 感谢罐 / 夸夸罐(全屏页):两人共享的小纸条罐子。
 * 随时丢一张暖心话,两人都能看、都能加;心情低落时「摇一摇」随机浮出一张过往的。
 */
export default function GratitudeJar({
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
  const [notes, setNotes] = useState<Gratitude[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [writing, setWriting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [drawn, setDrawn] = useState<Gratitude | null>(null)
  const [shaking, setShaking] = useState(false)
  const [drawCount, setDrawCount] = useState(0) // 每次摇一摇自增:抽到同一张也强制卡片重新弹入

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('gratitudes')
      .select('*')
      .eq('couple_id', coupleId)
      .order('id', { ascending: false })
      .limit(300)
    if (!error && data) setNotes(data as Gratitude[])
    setLoading(false)
  }, [coupleId])

  useEffect(() => {
    void load()
  }, [load])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || busy) return
    setBusy(true)
    setErr('')
    try {
      // 罐子无幂等键,单次插入(失败给提示,不静默),避免重试写重复
      const { error } = await supabase
        .from('gratitudes')
        .insert({ couple_id: coupleId, author_id: userId, content })
      if (error) throw error
      setDraft('')
      setWriting(false)
      fireEffect(['💗', '✨', '🫙'], 14)
      await load()
    } catch (e2) {
      setErr(friendlyWriteError(e2))
    } finally {
      setBusy(false)
    }
  }

  const shake = () => {
    if (notes.length === 0) return
    setShaking(true)
    setTimeout(() => setShaking(false), 600)
    // 稍等罐子晃完再浮出一张,更有仪式感
    setTimeout(() => {
      const pick = notes[Math.floor(Math.random() * notes.length)]
      setDrawn(pick)
      setDrawCount((c) => c + 1)
      fireEffect(['💛', '💗', '✨'], 12)
      navigator.vibrate?.(30)
    }, 350)
  }

  const remove = async (g: Gratitude) => {
    if (!window.confirm(t('从罐子里拿走这张?'))) return
    setErr('')
    try {
      await withRetry(async () => {
        const { error } = await supabase.from('gratitudes').delete().eq('id', g.id)
        if (error) throw error
      })
      if (drawn?.id === g.id) setDrawn(null)
      await load()
    } catch (e2) {
      setErr(friendlyWriteError(e2))
    }
  }

  const authorLabel = (g: Gratitude) => (g.author_id === userId ? t('我') : partnerName)

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-warmbg">
      <header className="flex items-center gap-2 border-b border-line bg-white/85 backdrop-blur-md px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="px-1 text-2xl text-gray-400">
          ‹
        </button>
        <h1 className="flex-1 text-base font-semibold text-primary-dark">{t('感谢罐')}</h1>
        <button
          type="button"
          onClick={() => setWriting(true)}
          className="rounded-full bg-primary px-3 py-1.5 text-sm text-white"
        >
          {t('✍ 写一张')}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* 罐子 + 摇一摇 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-amber-50 to-rose-50 p-6 text-center">
          {notes.length > 0 && <FloatLayer items={['💛', '💗', '✨']} count={8} />}
          <div className={`relative text-7xl ${shaking ? 'jar-shake' : ''}`}>🫙</div>
          <p className="mt-2 text-sm text-gray-500">
            {loading
              ? t('打开罐子…')
              : notes.length > 0
                ? t('罐子里有 {n} 张暖心话', { n: notes.length })
                : t('罐子还空空的,写第一张丢进去吧')}
          </p>
          {notes.length > 0 && (
            <button
              type="button"
              onClick={shake}
              className="btn-primary mt-3 rounded-full px-6 py-2.5 text-sm"
            >
              {t('🫶 摇一摇,随机浮出一张')}
            </button>
          )}
          {drawn && (
            <div
              key={`${drawn.id}-${drawCount}`}
              className="modal-pop mt-4 rounded-2xl bg-white px-4 py-4 text-left shadow-sm"
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{drawn.content}</p>
              <p className="mt-2 text-xs text-gray-300">
                {t('{name} · {d}', { name: authorLabel(drawn), d: fmtDate(drawn.created_at) })}
              </p>
            </div>
          )}
        </div>

        {err && <p className="mt-3 text-center text-xs text-red-500">{err}</p>}

        {/* 全部纸条 */}
        {notes.length > 0 && (
          <>
            <p className="mb-1.5 mt-4 px-1 text-xs text-gray-400">{t('罐子里的全部')}</p>
            <div className="space-y-2">
              {notes.map((g) => (
                <div key={g.id} className="rounded-2xl bg-white p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{g.content}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-300">
                    <span>
                      {authorLabel(g)} · {fmtDate(g.created_at)}
                    </span>
                    {g.author_id === userId && (
                      <button type="button" onClick={() => void remove(g)} className="px-1">
                        {t('拿走')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 写一张 */}
      {writing && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={() => setWriting(false)}
        >
          <form
            onSubmit={add}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-md rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
          >
            <p className="mb-3 text-center text-sm font-medium text-gray-500">
              {t('丢一张暖心话进罐子')}
            </p>
            <textarea
              className="input w-full resize-none"
              rows={3}
              maxLength={300}
              placeholder={t('谢谢 TA / 夸夸 TA / 记下这一刻的喜欢…')}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setDraft((d) => (d ? d : tpl))}
                  className="rounded-full border border-line bg-soft px-3 py-1 text-xs text-gray-600 active:scale-95"
                >
                  {tpl}
                </button>
              ))}
            </div>
            <button type="submit" disabled={busy || !draft.trim()} className="btn-primary mt-4 w-full">
              {busy ? t('放进罐子…') : t('放进罐子 🫙')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
