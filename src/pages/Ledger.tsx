import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { categoryIcon, useExpenses } from '../hooks/useExpenses'
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

/** 记账页:月度汇总 + 按日流水 + 记一笔 */
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

  // 汇总:总额、双方各付、分类占比(整月数据在内存里直接算)
  const summary = useMemo(() => {
    let total = 0
    let mine = 0
    const byCat = new Map<string, number>()
    for (const e of expenses) {
      const amt = Number(e.amount)
      total += amt
      if (e.payer_id === userId) mine += amt
      byCat.set(e.category, (byCat.get(e.category) ?? 0) + amt)
    }
    const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1])
    return { total, mine, theirs: total - mine, cats }
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
      <header className="flex items-center justify-center gap-4 border-b border-line bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
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

      <div className="flex-1 overflow-y-auto px-4 py-4">
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
            {/* 月度汇总卡 */}
            <div className="rounded-2xl bg-white p-4">
              <p className="text-sm text-gray-400">本月共支出</p>
              <p className="mt-1 text-2xl font-bold">¥{fmtMoney(summary.total)}</p>

              {summary.total > 0 && (
                <>
                  {/* 双方支出对比条 */}
                  <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="bg-primary"
                      style={{ width: `${(summary.mine / summary.total) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-gray-400">
                    <span>
                      <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />
                      {profile?.display_name ?? '我'} ¥{fmtMoney(summary.mine)}
                    </span>
                    <span>
                      {partner?.display_name ?? 'TA'} ¥{fmtMoney(summary.theirs)}
                      <span className="ml-1 inline-block h-2 w-2 rounded-full bg-gray-300" />
                    </span>
                  </div>

                  {/* 分类占比 */}
                  <div className="mt-4 space-y-2">
                    {summary.cats.map(([cat, amt]) => (
                      <div key={cat} className="flex items-center gap-2 text-xs">
                        <span className="w-14 shrink-0">
                          {categoryIcon(cat)} {cat}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-primary opacity-70"
                            style={{ width: `${(amt / summary.total) * 100}%` }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right text-gray-500">
                          ¥{fmtMoney(amt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

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
                    {fmtDay(day)} · 共¥
                    {fmtMoney(list.reduce((s, e) => s + Number(e.amount), 0))}
                  </p>
                  <div className="divide-y divide-line overflow-hidden rounded-2xl bg-white">
                    {list.map((e) => {
                      const mine = e.payer_id === userId
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
                            <span className="block truncate text-sm">{e.note || e.category}</span>
                            <span className="block text-xs text-gray-400">
                              {nameOf(e.payer_id)}付{mine && ' · 点击可修改'}
                            </span>
                          </span>
                          <span className="shrink-0 font-medium">¥{fmtMoney(Number(e.amount))}</span>
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
