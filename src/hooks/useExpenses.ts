import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Expense } from '../types/db'

/** 六个固定分类(与 CLAUDE.md 一致) */
export const CATEGORIES = [
  { id: '餐饮', icon: '🍜' },
  { id: '交通', icon: '🚇' },
  { id: '购物', icon: '🛍️' },
  { id: '娱乐', icon: '🎮' },
  { id: '日用', icon: '🧻' },
  { id: '其他', icon: '📦' },
] as const

export const categoryIcon = (c: string) => CATEGORIES.find((x) => x.id === c)?.icon ?? '📦'

/** 新增/编辑一笔的表单数据 */
export interface ExpenseInput {
  amount: number
  category: string
  note: string
  spent_at: string
}

/** 'YYYY-MM' → 该月起止(查询用半开区间) */
function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  const start = `${ym}-01`
  const next =
    m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start, next }
}

/**
 * 记账数据 Hook:按月整月加载(两人一个月几十条,无分页压力),
 * 增删改后整体重拉,简单可靠;回到前台自动刷新以看到对方新记的账。
 */
export function useExpenses(coupleId: string, userId: string, month: string) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    const { start, next } = monthRange(month)
    const { data, error: err } = await supabase
      .from('expenses')
      .select('*')
      .eq('couple_id', coupleId)
      .gte('spent_at', start)
      .lt('spent_at', next)
      .order('spent_at', { ascending: false })
      .order('id', { ascending: false })
    if (err) setError(true)
    else setExpenses(data as Expense[])
    setLoading(false)
  }, [coupleId, month])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  /** 记一笔(RLS 要求付款人必须是登录者本人) */
  const add = useCallback(
    async (input: ExpenseInput) => {
      const { error: err } = await supabase.from('expenses').insert({
        couple_id: coupleId,
        payer_id: userId,
        amount: input.amount,
        category: input.category,
        note: input.note || null,
        spent_at: input.spent_at,
      })
      if (err) throw err
      await load()
    },
    [coupleId, userId, load],
  )

  /** 修改自己记的一笔 */
  const update = useCallback(
    async (id: number, input: ExpenseInput) => {
      const { error: err } = await supabase
        .from('expenses')
        .update({
          amount: input.amount,
          category: input.category,
          note: input.note || null,
          spent_at: input.spent_at,
        })
        .eq('id', id)
      if (err) throw err
      await load()
    },
    [load],
  )

  /** 删除自己记的一笔 */
  const remove = useCallback(
    async (id: number) => {
      const { error: err } = await supabase.from('expenses').delete().eq('id', id)
      if (err) throw err
      await load()
    },
    [load],
  )

  return { expenses, loading, error, reload: load, add, update, remove }
}
