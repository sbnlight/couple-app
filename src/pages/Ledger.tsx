import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { categoryIcon, currencySymbol, useExpenses } from '../hooks/useExpenses'
import type { ExpenseInput } from '../hooks/useExpenses'
import ExpenseForm from '../components/ExpenseForm'
import type { Expense } from '../types/db'

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const fmtMoney = (n: number) => n.toFixed(2)

/** '2026-06-10' → '6月10日 周三' */
function fmtDay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const wd = '日一二三四五六'[new Date(y, m - 1, d).getDay()]
  return `${m}月${d}日 周${wd}`
}

/** 每种货币一组的月度汇总 */
interface CurSummary {
  currency: string
  expense: number
  income: number
  mineExpense: number
  sharedExpense: number
  cats: [string, number][]
}

/** 记账页:月度汇总(按货币分组)+ 按日流水 + 记一笔 */
export default function Ledger() {
  const { couple, session, profile, partner } = useAuth()
  // 本页在 RequireCouple 守卫内,couple/session 必然存在
  const userId = session!.user.id
  const [month, setMonth] = useState(ymNow)
  const { expenses, loading, error, reload, add, update, remove } = useExpenses(
    couple!.id,
    userId,
    month,
  )
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Expense | null>(null)

  // 汇总:不同货币不能直接相加,按货币分别统计
  const summaries = useMemo<CurSummary[]>(() => {
    const map = new Map<
      string,
      {
        expense: number
        income: number
        mineExpense: number
        sharedExpense: number
        cats: Map<string, number>
      }
    >()
    for (const e of expenses) {
      let b = map.get(e.currency)
      if (!b) {
        b = { expense: 0, income: 0, mineExpense: 0, sharedExpense: 0, cats: new Map() }
        map.set(e.currency, b)
      }
      const amt = Number(e.amount)
      if (e.kind === 'income') {
        b.income += amt
        continue
      }
      b.expense += amt
      if (e.payer_id === userId) b.mineExpense += amt
      if (e.scope === 'shared') b.sharedExpense += amt
      b.cats.set(e.category, (b.cats.get(e.category) ?? 0) + amt)
    }
    return [...map.entries()]
      .map(([currency, b]) => ({
        currency,
        expense: b.expense,
        income: b.income,
        mineExpense: b.mineExpense,
        sharedExpense: b.sharedExpense,
        cats: [...b.cats.entries()].sort((a, c) => c[1] - a[1]),
      }))
      .sort((a, b) => b.expense - a.expense)
  }, [expenses, userId])

  // 按日分组(查询已按日期倒序)
  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of expenses) {
      const list = map.get(e.spent_at)
      if (list) list.push(e)
      else map.set(e.spent_at, [e])
    }
    return [...map.entries()]
  }, [expenses])

  /** 某一天的支出小计(按货币拼接,如 ¥32.00 + $5.00) */
  const daySubtotal = (list: Expense[]) => {
    const m = new Map<string, number>()
    for (const e of list) {
      if (e.kind === 'expense') m.set(e.currency, (m.get(e.currency) ?? 0) + Number(e.amount))
    }
    return [...m.entries()].map(([c, v]) => `${currencySymbol(c)}${fmtMoney(v)}`).join(' + ')
  }

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const isCurrentMonth = month === ymNow()
  const [yy, mm] = month.split('-').map(Number)

  const handleSave = async (input: ExpenseInput) => {
    if (editTarget) await update(editTarget.id, input)
    else await add(input)
  }

  const nameOf = (payerId: string) =>
    payerId === userId ? (profile?.display_name ?? '我') : (partner?.display_name ?? 'TA')

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏:月份切换 */}
      <header className="flex items-center justify-center gap-4 border-b border-line bg-white/85 backdrop-blur-md px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => changeMonth(-1)} className="px-2 text-gray-400">
          ◀
        </button>
        <h1 className="text-base font-semibold text-primary-dark">
          {yy}年{mm}月
        </h1>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          disabled={isCurrentMonth}
          className="px-2 text-gray-400 disabled:opacity-30"
        >
          ▶
        </button>
      </header>

      <div className="page-in flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-300">加载中…</p>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-gray-400">账单加载失败</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-full border border-primary px-4 py-1.5 text-sm text-primary-dark"
            >
              重新加载
            </button>
          </div>
        ) : (
          <>
            {/* 月度汇总卡:每种货币一块 */}
            {summaries.map((s) => {
              const sym = currencySymbol(s.currency)
              return (
                <div key={s.currency} className="mb-3 rounded-2xl bg-white p-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm text-gray-400">
                        本月支出{summaries.length > 1 && `(${s.currency})`}
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {sym}
                        {fmtMoney(s.expense)}
                      </p>
                    </div>
                    {s.income > 0 && (
                      <p className="text-sm text-green-600">
                        收入 +{sym}
                        {fmtMoney(s.income)}
                      </p>
                    )}
                  </div>

                  {s.expense > 0 && (
                    <>
                      {/* 双方支出对比条 */}
                      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="bg-primary"
                          style={{ width: `${(s.mineExpense / s.expense) * 100}%` }}
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs text-gray-400">
                        <span>
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />
                          {profile?.display_name ?? '我'} {sym}
                          {fmtMoney(s.mineExpense)}
                        </span>
                        <span>
                          {partner?.display_name ?? 'TA'} {sym}
                          {fmtMoney(s.expense - s.mineExpense)}
                          <span className="ml-1 inline-block h-2 w-2 rounded-full bg-gray-300" />
                        </span>
                      </div>

                      {/* 共同 / 个人 */}
                      <p className="mt-2 text-xs text-gray-400">
                        👫 共同 {sym}
                        {fmtMoney(s.sharedExpense)} · 🙋 个人 {sym}
                        {fmtMoney(s.expense - s.sharedExpense)}
                      </p>

                      {/* 分类占比 */}
                      <div className="mt-3 space-y-2">
                        {s.cats.map(([cat, amt]) => (
                          <div key={cat} className="flex items-center gap-2 text-xs">
                            <span className="w-14 shrink-0">
                              {categoryIcon(cat)} {cat}
                            </span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-primary opacity-70"
                                style={{ width: `${(amt / s.expense) * 100}%` }}
                              />
                            </div>
                            <span className="w-20 shrink-0 text-right text-gray-500">
                              {sym}
                              {fmtMoney(amt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {/* 按日流水 */}
            {expenses.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-gray-300">
                <span className="text-4xl">📒</span>
                <p className="text-sm">
                  {isCurrentMonth ? '本月还没有记账,点右下角记一笔吧' : '这个月没有账目'}
                </p>
              </div>
            ) : (
              groups.map(([day, list]) => (
                <div key={day} className="mt-4">
                  <p className="mb-1.5 px-1 text-xs text-gray-400">
                    {fmtDay(day)}
                    {daySubtotal(list) && ` · 支出 ${daySubtotal(list)}`}
                  </p>
                  <div className="divide-y divide-line overflow-hidden rounded-2xl bg-white">
                    {list.map((e) => {
                      const mine = e.payer_id === userId
                      const sym = currencySymbol(e.currency)
                      return (
                        <button
                          key={e.id}
                          type="button"
                          disabled={!mine}
                          onClick={() => setEditTarget(e)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-soft disabled:opacity-100"
                        >
                          <span className="text-xl">{categoryIcon(e.category)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">
                              {e.note || e.category}
                              {e.scope === 'personal' && (
                                <span className="ml-1.5 rounded bg-gray-100 px-1 py-0.5 text-[0.65rem] text-gray-400">
                                  个人
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-gray-400">
                              {nameOf(e.payer_id)}
                              {e.kind === 'income' ? '收' : '付'}
                              {mine && ' · 点击可修改'}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 font-medium ${e.kind === 'income' ? 'text-green-600' : ''}`}
                          >
                            {e.kind === 'income' ? '+' : ''}
                            {sym}
                            {fmtMoney(Number(e.amount))}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
            {/* 给悬浮按钮留出空间 */}
            <div className="h-20" />
          </>
        )}
      </div>

      {/* 记一笔悬浮按钮 */}
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50vw-13rem))] rounded-full bg-primary px-5 py-3 font-medium text-white shadow-lg active:bg-primary-dark"
      >
        ＋ 记一笔
      </button>

      {(formOpen || editTarget) && (
        <ExpenseForm
          initial={editTarget ?? undefined}
          onSave={handleSave}
          onDelete={editTarget ? () => remove(editTarget.id) : undefined}
          onClose={() => {
            setFormOpen(false)
            setEditTarget(null)
          }}
        />
      )}
    </div>
  )
}
