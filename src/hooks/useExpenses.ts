import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry, isUniqueViolation } from '../lib/net'
import type { Expense } from '../types/db'

/** 支出分类(与 CLAUDE.md 一致) */
export const CATEGORIES = [
  { id: '餐饮', icon: '🍜' },
  { id: '交通', icon: '🚇' },
  { id: '购物', icon: '🛍️' },
  { id: '娱乐', icon: '🎮' },
  { id: '日用', icon: '🧻' },
  { id: '其他', icon: '📦' },
] as const

/** 收入分类 */
export const INCOME_CATEGORIES = [
  { id: '工资', icon: '💼' },
  { id: '兼职', icon: '🧰' },
  { id: '理财', icon: '📈' },
  { id: '红包', icon: '🧧' },
  { id: '报销', icon: '🧾' },
  { id: '其他', icon: '📦' },
] as const

export const categoryIcon = (c: string) =>
  [...CATEGORIES, ...INCOME_CATEGORIES].find((x) => x.id === c)?.icon ?? '📦'

/** 可选货币 */
export const CURRENCIES = [
  { code: 'CNY', symbol: '¥', label: '人民币' },
  { code: 'USD', symbol: '$', label: '美元' },
  { code: 'EUR', symbol: '€', label: '欧元' },
  { code: 'JPY', symbol: 'JP¥', label: '日元' },
  { code: 'GBP', symbol: '£', label: '英镑' },
] as const

export const currencySymbol = (code: string) =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? code

const CURRENCY_KEY = 'pref-currency'

/** 本机默认货币:记一笔时选了什么,下次默认就是什么 */
export function getDefaultCurrency(): string {
  const v = localStorage.getItem(CURRENCY_KEY)
  return CURRENCIES.some((c) => c.code === v) ? (v as string) : 'CNY'
}

export function saveDefaultCurrency(code: string) {
  localStorage.setItem(CURRENCY_KEY, code)
}

/** 新增/编辑一笔的表单数据 */
export interface ExpenseInput {
  amount: number
  category: string
  note: string
  spent_at: string
  currency: string
  kind: 'expense' | 'income'
  scope: 'shared' | 'personal'
  /** 幂等键:仅新增时用(每次「记一笔」打开生成一个,重发/重试复用同一个);编辑忽略 */
  client_id?: string
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
      // 弱网重试:一笔插入可能「已提交但响应超 10s 被中止」,重试/重发命中同一 client_id
      // 会被唯一约束拦下,这里把唯一冲突当作「已记成功」,杜绝重复账目。
      await withRetry(async () => {
        const { error: err } = await supabase.from('expenses').insert({
          couple_id: coupleId,
          payer_id: userId,
          amount: input.amount,
          category: input.category,
          note: input.note || null,
          spent_at: input.spent_at,
          currency: input.currency,
          kind: input.kind,
          scope: input.scope,
          client_id: input.client_id ?? null,
        })
        if (err && !isUniqueViolation(err)) throw err
      })
      await load()
    },
    [coupleId, userId, load],
  )

  /**
   * 修改自己记的一笔。若把日期改到了别的月份,当前月列表会重拉后不含它,
   * 返回目标月份字符串('YYYY-MM')供调用方提示"已移到 X 月";否则返回 null。
   */
  const update = useCallback(
    async (id: number, input: ExpenseInput): Promise<string | null> => {
      const { error: err } = await supabase
        .from('expenses')
        .update({
          amount: input.amount,
          category: input.category,
          note: input.note || null,
          spent_at: input.spent_at,
          currency: input.currency,
          kind: input.kind,
          scope: input.scope,
        })
        .eq('id', id)
      if (err) throw err
      await load()
      const targetMonth = input.spent_at.slice(0, 7)
      return targetMonth !== month ? targetMonth : null
    },
    [load, month],
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
