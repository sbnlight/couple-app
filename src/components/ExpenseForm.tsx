import { useState } from 'react'
import type { FormEvent } from 'react'
import { CATEGORIES } from '../hooks/useExpenses'
import type { ExpenseInput } from '../hooks/useExpenses'
import type { Expense } from '../types/db'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/**
 * 「记一笔」底部弹层。传入 initial 时为编辑模式(可删除)。
 * 付款人不可选:数据库安全规则要求只能以自己的身份记账。
 */
export default function ExpenseForm({
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  initial?: Expense
  onSave: (input: ExpenseInput) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category ?? '餐饮')
  const [note, setNote] = useState(initial?.note ?? '')
  const [spentAt, setSpentAt] = useState(initial?.spent_at ?? todayStr())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    const num = Number(amount)
    if (!amount || Number.isNaN(num) || num <= 0) {
      setErr('请输入正确的金额')
      return
    }
    if (num >= 100_000_000) {
      setErr('金额超出范围了')
      return
    }
    if (!spentAt) {
      setErr('请选择日期')
      return
    }
    setBusy(true)
    setErr('')
    try {
      await onSave({
        amount: Math.round(num * 100) / 100, // 保留两位小数
        category,
        note: note.trim(),
        spent_at: spentAt,
      })
      onClose()
    } catch {
      setErr('保存失败,请检查网络后重试')
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || busy) return
    if (!window.confirm('删除这笔记账?')) return
    setBusy(true)
    try {
      await onDelete()
      onClose()
    } catch {
      setErr('删除失败,请重试')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
      >
        <p className="mb-4 text-center text-sm font-medium text-gray-500">
          {initial ? '修改这笔账' : '记一笔'}
        </p>

        {/* 金额 */}
        <div className="flex items-center gap-2 border-b border-line pb-2">
          <span className="text-2xl font-semibold text-primary-dark">¥</span>
          <input
            className="min-w-0 flex-1 bg-transparent text-3xl font-semibold outline-none"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            autoFocus={!initial}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* 分类六宫格 */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-xl border py-2.5 text-sm transition-colors ${
                category === c.id
                  ? 'border-primary bg-soft font-medium text-primary-dark'
                  : 'border-line text-gray-500'
              }`}
            >
              {c.icon} {c.id}
            </button>
          ))}
        </div>

        {/* 日期 + 备注 */}
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-sm text-gray-400">日期</span>
            <input
              className="input flex-1 py-2"
              type="date"
              max={todayStr()}
              value={spentAt}
              onChange={(e) => setSpentAt(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-sm text-gray-400">备注</span>
            <input
              className="input flex-1 py-2"
              type="text"
              placeholder="选填,比如:晚饭、地铁"
              maxLength={50}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>

        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}

        <div className="mt-5 flex gap-3">
          {initial && onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="flex-1 rounded-xl border border-red-200 py-3 text-red-500 disabled:opacity-50"
            >
              删除
            </button>
          )}
          <button type="submit" disabled={busy} className="btn-primary flex-[2]">
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
