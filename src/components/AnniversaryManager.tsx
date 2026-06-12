import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { daysUntil } from '../lib/time'
import type { Anniversary, Couple } from '../types/db'

/** 纪念日 / 见面日管理(底部弹层) */
export default function AnniversaryManager({
  couple,
  anniversaries,
  onAdd,
  onRemove,
  onCoupleChanged,
  onClose,
  onToast,
}: {
  couple: Couple
  anniversaries: Anniversary[]
  onAdd: (title: string, date: string) => Promise<void>
  onRemove: (id: number) => Promise<void>
  onCoupleChanged: () => Promise<void>
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const [meetDate, setMeetDate] = useState(couple.next_meet_date ?? '')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)

  /** 保存/清除下次见面日期 */
  const saveMeetDate = async (value: string | null) => {
    if (busy) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('couples')
        .update({ next_meet_date: value })
        .eq('id', couple.id)
      if (error) throw error
      await onCoupleChanged()
      setMeetDate(value ?? '')
      onToast(value ? '见面日期已设置 ✈️' : '已清除见面日期')
    } catch {
      onToast('保存失败,请重试')
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !title.trim() || !date) return
    setBusy(true)
    try {
      await onAdd(title.trim(), date)
      setTitle('')
      setDate('')
    } catch {
      onToast('添加失败,请重试')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (id: number) => {
    if (!window.confirm('删除这个纪念日?')) return
    try {
      await onRemove(id)
    } catch {
      onToast('删除失败,请重试')
    }
  }

  const fmtDays = (d: string) => {
    const n = daysUntil(d)
    if (n > 0) return `还有 ${n} 天`
    if (n === 0) return '就是今天 🎉'
    return `第 ${-n + 1} 天`
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-center text-sm font-medium text-gray-500">纪念日与见面日</p>

        {/* 下次见面 */}
        <p className="text-sm font-medium text-gray-500">✈️ 下次见面</p>
        <div className="mt-2 flex gap-2">
          <input
            className="input min-w-0 flex-1 py-2"
            type="date"
            value={meetDate}
            onChange={(e) => setMeetDate(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !meetDate}
            onClick={() => void saveMeetDate(meetDate)}
            className="btn-primary px-4 py-2"
          >
            保存
          </button>
          {couple.next_meet_date && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveMeetDate(null)}
              className="shrink-0 text-sm text-gray-400"
            >
              清除
            </button>
          )}
        </div>

        {/* 纪念日列表 */}
        <p className="mt-5 text-sm font-medium text-gray-500">🎀 纪念日</p>
        <div className="mt-2 divide-y divide-line">
          {anniversaries.map((a) => (
            <div key={a.id} className="flex items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{a.title}</span>
                <span className="block text-xs text-gray-400">
                  {a.anniv_date} · {fmtDays(a.anniv_date)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void handleRemove(a.id)}
                className="px-2 text-gray-300"
              >
                ✕
              </button>
            </div>
          ))}
          {anniversaries.length === 0 && (
            <p className="py-3 text-sm text-gray-300">
              还没有纪念日,比如「在一起的日子」「TA 的生日」
            </p>
          )}
        </div>

        {/* 添加 */}
        <form onSubmit={handleAdd} className="mt-3 flex gap-2">
          <input
            className="input min-w-0 flex-[1.2] py-2"
            type="text"
            placeholder="名称,如:在一起"
            maxLength={12}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="input min-w-0 flex-1 py-2"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !title.trim() || !date}
            className="btn-primary px-4 py-2"
          >
            添加
          </button>
        </form>

        <button
          type="button"
          className="mt-5 w-full border-t border-line py-3 text-center text-gray-500"
          onClick={onClose}
        >
          完成
        </button>
      </div>
    </div>
  )
}
