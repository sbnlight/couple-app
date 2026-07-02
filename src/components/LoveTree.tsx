import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { t } from '../lib/i18n'

/**
 * 爱情树(共同养成):不新增表,由你们已有的互动"浇灌"成长——
 * 成长值 = 在一起天数 + 打卡次数×2 + 想你次数。随成长值跨越阶段,树从种子长到花开彩虹。
 * 两人看到的是同一棵树(数据都来自小屋级统计)。
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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [c, m] = await Promise.all([
        supabase
          .from('checkins')
          .select('id', { count: 'exact', head: true })
          .eq('couple_id', coupleId),
        supabase
          .from('misses')
          .select('id', { count: 'exact', head: true })
          .eq('couple_id', coupleId),
      ])
      if (cancelled) return
      setCheckins(c.count ?? 0)
      setMisses(m.count ?? 0)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
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

  return (
    <div className="mt-4 rounded-2xl bg-gradient-to-b from-emerald-50 to-white p-5">
      <p className="text-sm font-medium text-gray-500">{t('🌳 我们的爱情树')}</p>
      <div className="mt-2 flex items-center gap-4">
        <span className="text-5xl">{loading ? '🌱' : stage.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-emerald-700">{t(stage.name)}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {t('浇灌值 {p}(在一起 {d} 天 · 打卡 {c} · 想你 {m})', {
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
    </div>
  )
}
