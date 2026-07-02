import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fireEffect } from '../lib/effects'
import { t } from '../lib/i18n'

/**
 * 爱情树(共同养成):不新增表,由你们已有的互动"浇灌"成长——
 * 成长值 = 在一起天数 ×1 + 打卡次数 ×2 + 想你次数 ×1。随成长值跨越阶段,
 * 树从种子长到花开彩虹。两人看到同一棵树(数据都来自小屋级统计)。
 * 点开卡片有"成长明细":讲清怎么让它长大 + 阶段阶梯 + 浇水互动。
 */

const STAGES = [
  { emoji: '🌱', name: '破土的种子', min: 0 },
  { emoji: '🌿', name: '抽芽的小苗', min: 30 },
  { emoji: '🪴', name: '茁壮的盆栽', min: 100 },
  { emoji: '🌳', name: '成荫的大树', min: 250 },
  { emoji: '🌲', name: '参天的常青树', min: 500 },
  { emoji: '🌸', name: '满树的花', min: 900 },
  { emoji: '🌈', name: '花开彩虹', min: 1500 },
]

const STAGE_KEY = 'love-tree-stage'

export default function LoveTree({
  coupleId,
  daysTogether,
}: {
  coupleId: string
  /** 在一起天数(没设在一起日期则传小屋建立天数) */
  daysTogether: number
}) {
  const [checkins, setCheckins] = useState(0)
  const [misses, setMisses] = useState(0)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [tip, setTip] = useState('')

  const loadCounts = async () => {
    const [c, m] = await Promise.all([
      supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId),
      supabase.from('misses').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId),
    ])
    setCheckins(c.count ?? 0)
    setMisses(m.count ?? 0)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!cancelled) await loadCounts()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId])

  const points = daysTogether + checkins * 2 + misses
  let stageIdx = 0
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (points >= STAGES[i].min) {
      stageIdx = i
      break
    }
  }
  const stage = STAGES[stageIdx]
  const next = STAGES[stageIdx + 1]
  const progress = next
    ? Math.min(100, Math.round(((points - stage.min) / (next.min - stage.min)) * 100))
    : 100

  // 升级撒花:本机记录上次阶段,长大到新阶段时庆祝一次
  useEffect(() => {
    if (loading) return
    const prev = Number(localStorage.getItem(STAGE_KEY) ?? '-1')
    if (stageIdx > prev) {
      if (prev >= 0) fireEffect(['🎉', '🌸', '✨', '🌿'], 34)
      localStorage.setItem(STAGE_KEY, String(stageIdx))
    }
  }, [loading, stageIdx])

  const water = () => {
    fireEffect(['💧', '🌿', '✨', '🍃'], 22)
    setTip(t('给小树浇了点水~ 多打卡、多想 TA,它会长得更快哦 🌱'))
    void loadCounts() // 顺便刷新(对方可能刚打卡/想你)
    setTimeout(() => setTip(''), 3200)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-2xl bg-gradient-to-b from-emerald-50 to-white p-5 text-left"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500">{t('🌳 我们的爱情树')}</p>
          <span className="text-xs text-gray-300">{t('看看怎么长大 ›')}</span>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <span className="text-5xl">{loading ? '🌱' : stage.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-emerald-700">{t(stage.name)}</p>
            <p className="mt-0.5 text-xs text-gray-400">
              {t('浇灌值 {p}(在一起 {d} · 打卡 {c} · 想你 {m})', {
                p: points,
                d: daysTogether,
                c: checkins,
                m: misses,
              })}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {next
                ? t('再攒 {n} 点就长成「{s}」', { n: next.min - points, s: t(next.name) })
                : t('已经长到最茂盛啦 🎉')}
            </p>
          </div>
        </div>
      </button>

      {/* 成长明细 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />

            {/* 顶部:当前形态 */}
            <div className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-emerald-50 to-white py-5">
              <span className="text-6xl">{stage.emoji}</span>
              <p className="mt-2 text-lg font-semibold text-emerald-700">{t(stage.name)}</p>
              <p className="mt-0.5 text-xs text-gray-400">{t('浇灌值 {p}', { p: points })}</p>
              <div className="mt-3 h-2 w-2/3 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {next
                  ? t('再攒 {n} 点就长成「{s}」', { n: next.min - points, s: t(next.name) })
                  : t('已经长到最茂盛啦 🎉')}
              </p>
            </div>

            {/* 怎么让它长大 */}
            <p className="mb-2 mt-5 text-sm font-medium text-gray-500">{t('🌿 怎么让它长大')}</p>
            <div className="space-y-2 rounded-2xl bg-soft p-4 text-sm">
              <div className="flex items-center justify-between">
                <span>{t('❤️ 在一起每天')}</span>
                <span className="text-gray-400">
                  {t('+1 · 已 {n}', { n: daysTogether })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('📍 每次打卡')}</span>
                <span className="text-gray-400">{t('+2 · 已 {n}', { n: checkins })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t('💭 每次想 TA')}</span>
                <span className="text-gray-400">{t('+1 · 已 {n}', { n: misses })}</span>
              </div>
            </div>

            {/* 阶段阶梯 */}
            <p className="mb-2 mt-5 text-sm font-medium text-gray-500">{t('🪜 成长阶梯')}</p>
            <div className="space-y-1.5">
              {STAGES.map((s, i) => {
                const reached = points >= s.min
                const current = i === stageIdx
                return (
                  <div
                    key={s.name}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                      current ? 'bg-emerald-50 ring-1 ring-emerald-200' : ''
                    }`}
                  >
                    <span className={`text-2xl ${reached ? '' : 'opacity-30 grayscale'}`}>
                      {s.emoji}
                    </span>
                    <span
                      className={`flex-1 text-sm ${reached ? 'text-gray-700' : 'text-gray-300'}`}
                    >
                      {t(s.name)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {reached ? (current ? t('当前') : '✓') : t('{n} 点', { n: s.min })}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 浇水 */}
            {tip && <p className="mt-4 text-center text-xs text-emerald-600">{tip}</p>}
            <button
              type="button"
              onClick={water}
              className="mt-3 w-full rounded-full bg-emerald-400 py-3 text-base font-medium text-white active:scale-95"
            >
              {t('💧 给小树浇浇水')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 w-full py-2 text-center text-sm text-gray-400"
            >
              {t('完成')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
