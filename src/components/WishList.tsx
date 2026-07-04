import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry, friendlyWriteError } from '../lib/net'
import type { Wish } from '../types/db'
import { t } from '../lib/i18n'

/** 恋爱清单灵感模板:一键添加想一起做的事(已在清单里的会自动隐藏) */
const WISH_TEMPLATES = [
  '一起看一次日出',
  '一起看一次日落',
  '一起去看海',
  '一起看极光',
  '一起看一场雪',
  '一起去一次演唱会',
  '一起看一部深夜电影',
  '一起做一顿饭',
  '一起烤一次蛋糕',
  '一起养一盆植物',
  '一起拍一组情侣照',
  '一起去游乐园坐过山车',
  '一起去泡温泉',
  '一起看星星',
  '一起放一次烟花',
  '一起骑车压马路',
  '一起去一次长途旅行',
  '一起坐一次摩天轮',
  '一起去图书馆待一下午',
  '一起学一支舞',
  '一起完成一幅拼图',
  '一起写下给十年后的信',
  '一起过一个不看手机的周末',
  '一起去菜市场买菜',
  '一起淋一场雨',
  '一起看一次球赛',
  '一起做一次手工',
  '一起去露营看银河',
  '一起重走第一次约会的路',
  '一起给对方读一本书',
]

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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [err, setErr] = useState('')

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

  // 愿望表无幂等键,自动重试插入可能写重复,故插入只尝试一次,失败给出提示(不再静默丢弃)
  const insertWish = async (content: string) => {
    const { error } = await supabase
      .from('wishes')
      .insert({ couple_id: coupleId, creator_id: userId, content })
    if (error) throw error
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content || busy) return
    setBusy(true)
    setErr('')
    try {
      await insertWish(content)
      setDraft('')
      await load()
    } catch (e2) {
      setErr(friendlyWriteError(e2))
    } finally {
      setBusy(false)
    }
  }

  /** 从模板一键添加(去重:已在清单里的不再重复添加) */
  const addPreset = async (content: string) => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await insertWish(content)
      await load()
    } catch (e2) {
      setErr(friendlyWriteError(e2))
    } finally {
      setBusy(false)
    }
  }

  // 打勾 / 删除是按 id 的幂等操作,弱网可安全重试;失败要反映到 UI(不再静默 no-op)
  const toggle = async (w: Wish) => {
    setErr('')
    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('wishes')
          .update({ done: !w.done, done_at: w.done ? null : new Date().toISOString() })
          .eq('id', w.id)
        if (error) throw error
      })
      await load()
    } catch (e2) {
      setErr(friendlyWriteError(e2))
    }
  }

  const remove = async (w: Wish) => {
    if (!window.confirm(t('删除这个愿望?'))) return
    setErr('')
    try {
      await withRetry(async () => {
        const { error } = await supabase.from('wishes').delete().eq('id', w.id)
        if (error) throw error
      })
      await load()
    } catch (e2) {
      setErr(friendlyWriteError(e2))
    }
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
        aria-label={w.done ? t('标记为未完成') : t('标记为完成')}
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
          {t('{name}许的愿', { name: w.creator_id === userId ? t('我') : partnerName })}
        </span>
      </span>
      <button type="button" onClick={() => void remove(w)} className="px-1 text-gray-300">
        ✕
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-warmbg">
      <header className="flex items-center gap-2 border-b border-line bg-white/85 backdrop-blur-md px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="px-1 text-2xl text-gray-400">
          ‹
        </button>
        <h1 className="flex-1 text-base font-semibold text-primary-dark">{t('愿望清单')}</h1>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-full bg-soft px-3 py-1.5 text-xs text-primary-dark"
        >
          {t('💡 灵感')}
        </button>
      </header>

      {/* 添加 */}
      <form onSubmit={handleAdd} className="flex gap-2 border-b border-line bg-white/85 backdrop-blur-md px-4 py-3">
        <input
          className="input min-w-0 flex-1 py-2"
          type="text"
          placeholder={t('想一起做的事,比如:去看极光')}
          maxLength={60}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" disabled={busy || !draft.trim()} className="btn-primary px-4 py-2">
          {t('许愿')}
        </button>
      </form>
      {err && (
        <p className="border-b border-line bg-red-50 px-4 py-2 text-center text-xs text-red-500">
          {err}
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-300">{t('加载中…')}</p>
        ) : wishes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-300">
            <span className="text-4xl">🌠</span>
            <p className="text-sm">{t('还没有愿望,写下你们想一起做的事吧')}</p>
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
                  {t('已实现 {n} 个 🎉', { n: done.length })}
                </p>
                <div className="divide-y divide-line rounded-2xl bg-white px-4">
                  {done.map(renderItem)}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* 灵感清单:一键添加想一起做的事(已添加的自动隐藏) */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="mx-auto max-h-[75vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-center text-sm font-medium text-gray-500">
              {t('想一起做的事 · 点一下加入清单')}
            </p>
            <div className="flex flex-wrap gap-2">
              {WISH_TEMPLATES.filter((tpl) => !wishes.some((w) => w.content === tpl)).map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  disabled={busy}
                  onClick={() => void addPreset(tpl)}
                  className="rounded-full border border-line bg-soft px-3 py-1.5 text-sm text-gray-600 active:scale-95 disabled:opacity-50"
                >
                  ＋ {tpl}
                </button>
              ))}
              {WISH_TEMPLATES.every((tpl) => wishes.some((w) => w.content === tpl)) && (
                <p className="w-full py-4 text-center text-sm text-gray-300">
                  {t('灵感都加完啦,你们真有行动力 🎉')}
                </p>
              )}
            </div>
            <button
              type="button"
              className="mt-4 w-full border-t border-line py-3 text-center text-gray-500"
              onClick={() => setPickerOpen(false)}
            >
              {t('完成')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
