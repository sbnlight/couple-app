import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { categoryIcon, currencySymbol, CURRENCIES, useExpenses } from '../hooks/useExpenses'
import type { ExpenseInput } from '../hooks/useExpenses'
import ExpenseForm from '../components/ExpenseForm'
import { CountUp, FloatLayer } from '../components/Fx'
import { fireEffect } from '../lib/effects'
import { withRetry, friendlyWriteError } from '../lib/net'
import type { Expense } from '../types/db'
import { t } from '../lib/i18n'

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const fmtMoney = (n: number) => n.toFixed(2)

/** '2026-06-10' → '6月10日 周三'(随语言本地化) */
function fmtDay(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const wd = '日一二三四五六'[new Date(y, m - 1, d).getDay()]
  return `${t('{m}月{d}日', { m, d })} ${t(`周${wd}`)}`
}

/** 近 6 个月支出趋势(按货币分线) */
interface TrendData {
  yms: string[]
  series: { currency: string; values: number[] }[]
}

const TREND_COLORS = ['var(--c-primary)', '#60a5fa']

/** 折线图(纯 SVG) */
function TrendChart({ yms, series }: TrendData) {
  const W = 320
  const H = 120
  const PAD = 16
  // 防除零:只有一个点时分母用 1(实际 yms 恒为 6,这里仅稳健兜底)
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, yms.length - 1)
  // 每条币种各用自己的 max 归一,避免 ¥ 与 $ 量级悬殊时小额币种被压平贴底、趋势失真
  const y = (v: number, m: number) => H - 24 - (v / m) * (H - 42)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {series.map((s, si) => {
        const sMax = Math.max(1, ...s.values)
        return (
          <g key={s.currency}>
            <polyline
              fill="none"
              stroke={TREND_COLORS[si]}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="chart-draw"
              style={{ animationDelay: `${0.15 + si * 0.25}s` }}
              points={s.values.map((v, i) => `${x(i)},${y(v, sMax)}`).join(' ')}
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v, sMax)} r="3" fill={TREND_COLORS[si]} className="chart-dot" />
            ))}
          </g>
        )
      })}
      {yms.map((ym, i) => (
        <text key={ym} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">
          {Number(ym.slice(5))}月
        </text>
      ))}
    </svg>
  )
}

const DONUT_COLORS = ['var(--c-primary)', '#f59e0b', '#60a5fa', '#34d399', '#a78bfa', '#94a3b8']

/** 分类占比环形图(纯 SVG) */
function Donut({ cats, total, sym }: { cats: [string, number][]; total: number; sym: string }) {
  // 挂载后把每段从 0 长到目标弧长(尊重"减弱动态":直接长好)
  const [grown, setGrown] = useState(
    () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (grown) return
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [grown])
  const R = 40
  const C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        {cats.map(([cat, amt], i) => {
          const frac = amt / total
          const seg = (
            <circle
              key={cat}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth="14"
              strokeDasharray={grown ? `${frac * C} ${C}` : `0 ${C}`}
              strokeDashoffset={-acc * C}
              style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
          )
          acc += frac
          return seg
        })}
        </svg>
        {/* 环中心:本月支出总额,数字滚动 */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[9px] leading-tight text-gray-400">{t('本月支出')}</span>
          <span className="text-xs font-bold text-primary-dark">
            {sym}
            <CountUp value={total} decimals={2} />
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {cats.slice(0, 6).map(([cat, amt], i) => (
          <p key={cat} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="truncate">
              {cat} {Math.round((amt / total) * 100)}%
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}

/** 生长条:挂载后宽度从 0 缓动到目标,尊重"减少动态"(直接到位)。修首屏 transition 不触发 */
function GrowBar({ pct, className }: { pct: number; className?: string }) {
  const [grown, setGrown] = useState(
    () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (grown) return
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [grown])
  return <div className={className} style={{ width: grown ? `${Math.max(0, pct)}%` : '0%' }} />
}

/** 每种货币一组的月度汇总 */
interface CurSummary {
  currency: string
  expense: number
  income: number
  mineExpense: number
  sharedExpense: number
  /** 共同支出里我付的部分(用于 AA 结算) */
  mySharedExpense: number
  cats: [string, number][]
}

/** 记账页:月度汇总(按货币分组)+ 按日流水 + 记一笔 */
export default function Ledger() {
  const { couple, session, profile, partner, refresh } = useAuth()
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
  const [trend, setTrend] = useState<TrendData | null>(null)
  const [toast, setToast] = useState('')
  const toastTimerRef = useRef<number | undefined>(undefined)
  const showToast = (msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2500)
  }

  // 月度预算(小屋级共享,存 feature_flags):budget_cur 货币 + budget_amt 金额
  const flags = couple?.feature_flags ?? {}
  const budgetCur = typeof flags.budget_cur === 'string' ? flags.budget_cur : ''
  const budgetAmt = Number(flags.budget_amt) || 0
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetCurInput, setBudgetCurInput] = useState(budgetCur || 'CNY')

  const saveBudget = async (amt: number | null, cur: string) => {
    if (!couple) return
    try {
      await withRetry(async () => {
        // 读最新 flags 再合并,避免覆盖对方同时改的其他设置(同 FeatureToggles 的做法)
        const { data, error: selErr } = await supabase
          .from('couples')
          .select('feature_flags')
          .eq('id', couple.id)
          .single()
        // 读失败必须中止:否则 fresh={} 会把对方设的其它开关一起覆盖掉(潜在数据丢失)
        if (selErr) throw selErr
        const fresh = (data?.feature_flags as Record<string, unknown> | null) ?? {}
        const next = { ...fresh }
        if (amt && amt > 0) {
          next.budget_amt = String(amt)
          next.budget_cur = cur
        } else {
          delete next.budget_amt
          delete next.budget_cur
        }
        const { error } = await supabase
          .from('couples')
          .update({ feature_flags: next })
          .eq('id', couple.id)
        if (error) throw error
      })
    } catch (e) {
      showToast(friendlyWriteError(e))
      return
    }
    setBudgetOpen(false)
    showToast(amt && amt > 0 ? t('预算已设置') : t('已取消预算'))
    void refresh()
  }

  // 近 6 个月支出趋势(记账有增删改时跟着 expenses 一起刷新)
  useEffect(() => {
    let ignore = false // 弱网/连续增删下丢弃过期请求,避免旧结果覆盖新结果
    const now = new Date()
    const yms: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      yms.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    const start = `${yms[0]}-01`
    const endD = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, '0')}-01`
    void (async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('spent_at, amount, currency')
        .eq('couple_id', couple!.id)
        .eq('kind', 'expense')
        .gte('spent_at', start)
        .lt('spent_at', end)
      if (error || !data || ignore) return
      const map = new Map<string, number[]>()
      for (const row of data as { spent_at: string; amount: number; currency: string }[]) {
        const idx = yms.indexOf(row.spent_at.slice(0, 7))
        if (idx < 0) continue
        let arr = map.get(row.currency)
        if (!arr) {
          arr = [0, 0, 0, 0, 0, 0]
          map.set(row.currency, arr)
        }
        arr[idx] += Number(row.amount)
      }
      const series = [...map.entries()]
        .map(([currency, values]) => ({ currency, values }))
        .sort((a, b) => b.values.reduce((s, v) => s + v, 0) - a.values.reduce((s, v) => s + v, 0))
        .slice(0, 2) // 最多画两条线,多了看不清
      if (!ignore) setTrend({ yms, series })
    })()
    return () => {
      ignore = true
    }
  }, [couple, expenses])

  // 环比文案(主货币:本月 vs 上月)
  const momText = useMemo(() => {
    const s = trend?.series[0]
    if (!s) return null
    const cur = s.values[5]
    const prev = s.values[4]
    if (prev <= 0 || cur <= 0) return null
    const pct = Math.round(((cur - prev) / prev) * 100)
    if (pct === 0) return t('{c} 支出与上月持平', { c: s.currency })
    return pct > 0
      ? t('{c} 支出比上月多 {n}%  ↗', { c: s.currency, n: pct })
      : t('{c} 支出比上月少 {n}%  ↘', { c: s.currency, n: -pct })
  }, [trend])

  // 汇总:不同货币不能直接相加,按货币分别统计
  const summaries = useMemo<CurSummary[]>(() => {
    const map = new Map<
      string,
      {
        expense: number
        income: number
        mineExpense: number
        sharedExpense: number
        mySharedExpense: number
        cats: Map<string, number>
      }
    >()
    for (const e of expenses) {
      let b = map.get(e.currency)
      if (!b) {
        b = {
          expense: 0,
          income: 0,
          mineExpense: 0,
          sharedExpense: 0,
          mySharedExpense: 0,
          cats: new Map(),
        }
        map.set(e.currency, b)
      }
      const amt = Number(e.amount)
      if (e.kind === 'income') {
        b.income += amt
        continue
      }
      b.expense += amt
      if (e.payer_id === userId) b.mineExpense += amt
      if (e.scope === 'shared') {
        b.sharedExpense += amt
        if (e.payer_id === userId) b.mySharedExpense += amt
      }
      b.cats.set(e.category, (b.cats.get(e.category) ?? 0) + amt)
    }
    return [...map.entries()]
      .map(([currency, b]) => ({
        currency,
        expense: b.expense,
        income: b.income,
        mineExpense: b.mineExpense,
        sharedExpense: b.sharedExpense,
        mySharedExpense: b.mySharedExpense,
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
    if (editTarget) {
      // 编辑时若把日期改到别的月份,当前月列表里这笔会消失,给出可见提示避免困惑
      const movedTo = await update(editTarget.id, input)
      if (movedTo) showToast(t('已移到 {m} 月', { m: Number(movedTo.slice(5, 7)) }))
    } else {
      await add(input)
      // 记一笔成功:撒一把硬币 + 即时提示(最高频操作,以前同月记完零反馈)
      fireEffect(input.kind === 'income' ? ['💵', '🤑', '✨'] : ['💰', '🪙', '✨'], 16)
      const savedMonth = input.spent_at.slice(0, 7)
      if (savedMonth !== month) showToast(t('已存到 {m} 月', { m: Number(savedMonth.slice(5, 7)) }))
      else showToast(t('已记一笔 {a}', { a: `${currencySymbol(input.currency)}${fmtMoney(input.amount)}` }))
    }
  }

  const nameOf = (payerId: string) =>
    payerId === userId ? (profile?.display_name ?? t('我')) : (partner?.display_name ?? t('TA'))

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏:月份切换 + 预算入口 */}
      <header className="relative flex items-center justify-center gap-4 border-b border-line bg-white/85 backdrop-blur-md px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => changeMonth(-1)} className="px-2 text-gray-400">
          ◀
        </button>
        <h1 className="text-base font-semibold text-primary-dark">
          {t('{y}年{m}月', { y: yy, m: mm })}
        </h1>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          disabled={isCurrentMonth}
          className="px-2 text-gray-400 disabled:opacity-30"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => {
            setBudgetInput(budgetAmt > 0 ? String(budgetAmt) : '')
            setBudgetCurInput(budgetCur || 'CNY')
            setBudgetOpen(true)
          }}
          className="absolute right-3 bottom-3 text-xs text-gray-400"
        >
          {t('💰 预算')}
        </button>
      </header>

      <div className="page-in flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          // 骨架屏:比"加载中…"更有质感,近似真实布局(汇总卡 + 图表 + 几条流水)
          <div className="space-y-3">
            <div className="rounded-2xl bg-white p-5">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton mt-2.5 h-7 w-32" />
              <div className="skeleton mt-3 h-2.5 w-full" />
            </div>
            <div className="rounded-2xl bg-white p-5">
              <div className="skeleton h-24 w-full" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-white p-4">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton mt-2 h-3 w-40" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-gray-400">{t('账单加载失败')}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-full border border-primary px-4 py-1.5 text-sm text-primary-dark"
            >
              {t('重新加载')}
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
                        {(() => {
                          // 浏览往月时不再写死"本月",改显具体月份,避免误导
                          const mm = Number(month.slice(5, 7))
                          const prefix = isCurrentMonth ? t('本月支出') : t('{m}月支出', { m: mm })
                          return summaries.length > 1 ? `${prefix}(${s.currency})` : prefix
                        })()}
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        <CountUp value={s.expense} decimals={2} prefix={sym} />
                      </p>
                    </div>
                    {s.income > 0 && (
                      <p className="text-sm text-green-600">
                        {t('收入 +{s}', { s: `${sym}${fmtMoney(s.income)}` })}
                      </p>
                    )}
                  </div>

                  {/* 月度预算进度(仅当月、且是设了预算的那种货币) */}
                  {isCurrentMonth && budgetAmt > 0 && s.currency === budgetCur && (
                    <div className="mt-3">
                      <div className="h-2.5 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className={`relative h-full overflow-hidden rounded-full bubble-shimmer ${
                            s.expense > budgetAmt ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, (s.expense / budgetAmt) * 100)}%` }}
                        />
                      </div>
                      <p
                        className={`mt-1 text-xs ${
                          s.expense > budgetAmt ? 'text-rose-500' : 'text-gray-400'
                        }`}
                      >
                        {s.expense > budgetAmt
                          ? t('⚠️ 已超预算 {a}(预算 {b})', {
                              a: `${sym}${fmtMoney(s.expense - budgetAmt)}`,
                              b: `${sym}${fmtMoney(budgetAmt)}`,
                            })
                          : t('预算 {b} · 还剩 {a}', {
                              b: `${sym}${fmtMoney(budgetAmt)}`,
                              a: `${sym}${fmtMoney(budgetAmt - s.expense)}`,
                            })}
                      </p>
                    </div>
                  )}

                  {s.expense > 0 && (
                    <>
                      {/* 双方支出对比条 */}
                      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-gray-200">
                        <GrowBar
                          className="bg-primary transition-[width] duration-700 ease-out"
                          pct={(s.mineExpense / s.expense) * 100}
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-xs text-gray-400">
                        <span>
                          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />
                          {profile?.display_name ?? t('我')} {sym}
                          {fmtMoney(s.mineExpense)}
                        </span>
                        <span>
                          {partner?.display_name ?? t('TA')} {sym}
                          {fmtMoney(s.expense - s.mineExpense)}
                          <span className="ml-1 inline-block h-2 w-2 rounded-full bg-gray-300" />
                        </span>
                      </div>

                      {/* 共同 / 个人 */}
                      <p className="mt-2 text-xs text-gray-400">
                        {t('👫 共同 {a} · 🙋 个人 {b}', {
                          a: `${sym}${fmtMoney(s.sharedExpense)}`,
                          b: `${sym}${fmtMoney(s.expense - s.sharedExpense)}`,
                        })}
                      </p>

                      {/* AA 结算:共同支出各出一半,算谁该补给谁 */}
                      {s.sharedExpense > 0 &&
                        (() => {
                          // 我付的共同 - 应付一半 = 我垫的净额;>0 对方补我,<0 我补对方
                          const net = s.mySharedExpense - s.sharedExpense / 2
                          const abs = Math.abs(net)
                          if (abs < 0.005)
                            return (
                              <p className="mt-1.5 rounded-lg bg-soft px-2.5 py-1.5 text-xs text-primary-dark">
                                {t('🤝 共同开销已 AA 平摊,谁也不欠谁')}
                              </p>
                            )
                          const meName = profile?.display_name ?? t('我')
                          const taName = partner?.display_name ?? t('TA')
                          return (
                            <p className="mt-1.5 rounded-lg bg-gradient-to-r from-amber-50 to-rose-50 px-2.5 py-1.5 text-xs font-medium text-primary-dark ring-1 ring-primary/10">
                              {net > 0
                                ? t('🤝 AA 结算:{who} 该补给你 {amt}', {
                                    who: taName,
                                    amt: `${sym}${fmtMoney(abs)}`,
                                  })
                                : t('🤝 AA 结算:你该补给 {who} {amt}', {
                                    who: taName,
                                    amt: `${sym}${fmtMoney(abs)}`,
                                  })}
                              <span className="ml-1 text-gray-400">
                                {t('({me}已付共同 {paid})', {
                                  me: meName,
                                  paid: `${sym}${fmtMoney(s.mySharedExpense)}`,
                                })}
                              </span>
                            </p>
                          )
                        })()}

                      {/* 分类占比 */}
                      <div className="mt-3 space-y-2">
                        {s.cats.map(([cat, amt]) => (
                          <div key={cat} className="flex items-center gap-2 text-xs">
                            <span className="w-14 shrink-0">
                              {categoryIcon(cat)} {cat}
                            </span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <GrowBar
                                className="h-full rounded-full bg-primary opacity-70 transition-[width] duration-700 ease-out"
                                pct={(amt / s.expense) * 100}
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

            {/* 设了当月预算、但这种货币这月还没花过 → 单独显示一张"还没花"的预算卡,避免预算隐身 */}
            {isCurrentMonth && budgetAmt > 0 && !summaries.some((s) => s.currency === budgetCur) && (
              <div className="mb-3 rounded-2xl bg-white p-4">
                <p className="text-sm text-gray-400">{t('本月预算({c})', { c: budgetCur })}</p>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: '0%' }} />
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {t('预算 {b} · 还没花,还剩 {a}', {
                    b: `${currencySymbol(budgetCur)}${fmtMoney(budgetAmt)}`,
                    a: `${currencySymbol(budgetCur)}${fmtMoney(budgetAmt)}`,
                  })}
                </p>
              </div>
            )}

            {/* 统计图表:趋势/环比/占比均相对"当前"计算,浏览往月时隐藏,避免与上方
                往月汇总错配(与下方分类占比的 isCurrentMonth 判断保持一致) */}
            {isCurrentMonth && trend && trend.series.length > 0 && (
              <div className="mb-3 rounded-2xl bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">{t('📈 近半年支出趋势')}</p>
                  <span className="flex gap-3 text-xs text-gray-400">
                    {trend.series.map((s, i) => (
                      <span key={s.currency} className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: TREND_COLORS[i] }}
                        />
                        {s.currency}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="mt-2">
                  <TrendChart yms={trend.yms} series={trend.series} />
                </div>
                {momText && <p className="text-xs text-gray-400">{momText}</p>}

                {isCurrentMonth && summaries[0] && summaries[0].expense > 0 && (
                  <>
                    <p className="mb-2 mt-4 text-sm font-medium text-gray-500">{t('本月分类占比')}</p>
                    <Donut
                      cats={summaries[0].cats}
                      total={summaries[0].expense}
                      sym={currencySymbol(summaries[0].currency)}
                    />
                  </>
                )}
              </div>
            )}

            {/* 按日流水 */}
            {expenses.length === 0 ? (
              <div className="relative flex flex-col items-center gap-2 overflow-hidden py-16 text-gray-300">
                <FloatLayer items={['🪙', '🧾', '💰', '✨']} count={10} />
                <span className="text-4xl">📒</span>
                <p className="text-sm">
                  {isCurrentMonth ? t('本月还没有记账,点右下角记一笔吧') : t('这个月没有账目')}
                </p>
              </div>
            ) : (
              groups.map(([day, list]) => (
                <div key={day} className="mt-4">
                  <p className="mb-1.5 px-1 text-xs text-gray-400">
                    {fmtDay(day)}
                    {daySubtotal(list) && ` · ${t('支出')} ${daySubtotal(list)}`}
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
                              {e.note || t(e.category)}
                              {e.scope === 'personal' && (
                                <span className="ml-1.5 rounded bg-gray-100 px-1 py-0.5 text-[0.65rem] text-gray-400">
                                  {t('个人')}
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-gray-400">
                              {e.kind === 'income'
                                ? t('{name}收', { name: nameOf(e.payer_id) })
                                : t('{name}付', { name: nameOf(e.payer_id) })}
                              {mine && t(' · 点击可修改')}
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
        {t('＋ 记一笔')}
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

      {/* 月度预算设置 */}
      {budgetOpen && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40"
          onClick={() => setBudgetOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-md rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-center text-sm font-medium text-gray-500">{t('月度预算')}</p>
            <p className="mb-3 text-center text-xs text-gray-300">
              {t('两人共享;当月支出超过预算会提醒(按选定货币)')}
            </p>
            <div className="flex gap-2">
              <select
                className="input py-2.5"
                value={budgetCurInput}
                onChange={(e) => setBudgetCurInput(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code}
                  </option>
                ))}
              </select>
              <input
                className="input min-w-0 flex-1 py-2.5"
                type="number"
                inputMode="decimal"
                min="0"
                placeholder={t('每月预算金额')}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => void saveBudget(Number(budgetInput), budgetCurInput)}
              className="btn-primary mt-3 w-full py-2.5"
            >
              {t('保存预算')}
            </button>
            {budgetAmt > 0 && (
              <button
                type="button"
                onClick={() => void saveBudget(null, budgetCurInput)}
                className="mt-2 w-full py-2 text-center text-sm text-gray-400"
              >
                {t('取消预算')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 轻提示 */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center">
          <span className="toast-in rounded-full bg-gray-800/80 px-4 py-2 text-sm text-white">
            {toast}
          </span>
        </div>
      )}
    </div>
  )
}
