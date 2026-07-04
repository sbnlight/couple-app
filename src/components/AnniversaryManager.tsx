import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { daysUntil, recurringUntil } from '../lib/time'
import { dayTzOf } from './FeatureToggles'
import { withRetry, friendlyWriteError } from '../lib/net'
import type { Anniversary, Couple } from '../types/db'
import { t } from '../lib/i18n'

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
  onAdd: (title: string, date: string, recurring: boolean) => Promise<void>
  onRemove: (id: number) => Promise<void>
  onCoupleChanged: () => Promise<void>
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const [meetDate, setMeetDate] = useState(couple.next_meet_date ?? '')
  const [togetherDate, setTogetherDate] = useState(couple.together_date ?? '')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [busy, setBusy] = useState(false)

  /** 保存/清除下次见面日期 */
  const saveMeetDate = async (value: string | null) => {
    if (busy) return
    setBusy(true)
    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('couples')
          .update({ next_meet_date: value })
          .eq('id', couple.id)
        if (error) throw error
      })
    } catch (e) {
      onToast(friendlyWriteError(e))
      return
    } finally {
      setBusy(false)
    }
    // 写入已成功;刷新 best-effort,放在 try 外,失败不报「保存失败」
    setMeetDate(value ?? '')
    onToast(value ? t('见面日期已设置 ✈️') : t('已清除见面日期'))
    void onCoupleChanged()
  }

  /** 保存/清除在一起的日子(恋爱计数大卡锚点) */
  const saveTogetherDate = async (value: string | null) => {
    if (busy) return
    setBusy(true)
    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('couples')
          .update({ together_date: value })
          .eq('id', couple.id)
        if (error) throw error
      })
    } catch (e) {
      onToast(friendlyWriteError(e))
      return
    } finally {
      setBusy(false)
    }
    setTogetherDate(value ?? '')
    onToast(value ? t('在一起的日子已设置 ❤️') : t('已清除'))
    void onCoupleChanged()
  }

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !title.trim() || !date) return
    setBusy(true)
    try {
      await onAdd(title.trim(), date, recurring)
      setTitle('')
      setDate('')
      setRecurring(false)
    } catch (e2) {
      onToast(friendlyWriteError(e2))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (id: number) => {
    if (!window.confirm(t('删除这个纪念日?'))) return
    try {
      await onRemove(id)
    } catch (e) {
      onToast(friendlyWriteError(e))
    }
  }

  // 年度重复项(生日/周年):用共用换日时区 + UTC 算术(异地一致、闰日安全)
  const nextRecurring = (dateStr: string) => recurringUntil(dateStr, dayTzOf(couple))

  const fmtDays = (a: Anniversary) => {
    if (a.recurring) {
      const { days, years } = nextRecurring(a.anniv_date)
      if (days === 0) return t('就是今天 🎉')
      return years > 0
        ? t('还有 {n} 天 · 第 {y} 周年', { n: days, y: years })
        : t('还有 {n} 天', { n: days })
    }
    const n = daysUntil(a.anniv_date, dayTzOf(couple))
    if (n > 0) return t('还有 {n} 天', { n })
    if (n === 0) return t('就是今天 🎉')
    return t('第 {n} 天', { n: -n + 1 })
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-center text-sm font-medium text-gray-500">{t('纪念日与见面日')}</p>

        {/* 在一起的日子(恋爱计数大卡) */}
        <p className="text-sm font-medium text-gray-500">{t('❤️ 在一起的日子')}</p>
        <div className="mb-4 mt-2 flex gap-2">
          <input
            className="input min-w-0 flex-1 py-2"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={togetherDate}
            onChange={(e) => setTogetherDate(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !togetherDate}
            onClick={() => void saveTogetherDate(togetherDate)}
            className="btn-primary px-4 py-2"
          >
            {t('保存')}
          </button>
          {couple.together_date && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveTogetherDate(null)}
              className="shrink-0 text-sm text-gray-400"
            >
              {t('清除')}
            </button>
          )}
        </div>

        {/* 下次见面 */}
        <p className="text-sm font-medium text-gray-500">{t('✈️ 下次见面')}</p>
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
            {t('保存')}
          </button>
          {couple.next_meet_date && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveMeetDate(null)}
              className="shrink-0 text-sm text-gray-400"
            >
              {t('清除')}
            </button>
          )}
        </div>

        {/* 纪念日列表 */}
        <p className="mt-5 text-sm font-medium text-gray-500">{t('🎀 纪念日')}</p>
        <div className="mt-2 divide-y divide-line">
          {anniversaries.map((a) => (
            <div key={a.id} className="flex items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{a.title}</span>
                <span className="block text-xs text-gray-400">
                  {a.anniv_date}
                  {a.recurring ? t(' · 每年') : ''} · {fmtDays(a)}
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
              {t('还没有纪念日,比如「在一起的日子」「TA 的生日」')}
            </p>
          )}
        </div>

        {/* 添加 */}
        <form onSubmit={handleAdd} className="mt-3">
          <div className="flex gap-2">
            <input
              className="input min-w-0 flex-[1.2] py-2"
              type="text"
              placeholder={t('名称,如:在一起')}
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
              {t('添加')}
            </button>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            {t('每年重复(生日 / 周年,到期自动倒计下一年)')}
          </label>
        </form>

        <button
          type="button"
          className="mt-5 w-full border-t border-line py-3 text-center text-gray-500"
          onClick={onClose}
        >
          {t('完成')}
        </button>
      </div>
    </div>
  )
}
