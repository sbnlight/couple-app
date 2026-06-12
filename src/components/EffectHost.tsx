import { useEffect, useState } from 'react'
import type { FxDetail } from '../lib/effects'

interface Drop {
  id: number
  emoji: string
  left: number
  delay: number
  dur: number
  size: number
}

let seq = 0

/**
 * 全屏表情雨渲染器:监听 window 的 couple-fx 事件。
 * 挂在主布局里一份即可,任何代码调 fireEffect() 都会在这里下雨。
 */
export default function EffectHost() {
  const [drops, setDrops] = useState<Drop[]>([])

  useEffect(() => {
    const onFx = (e: Event) => {
      const { emojis, count = 26 } = (e as CustomEvent<FxDetail>).detail
      const batch: Drop[] = Array.from({ length: count }, () => ({
        id: seq++,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        dur: 2.2 + Math.random() * 1.8,
        size: 18 + Math.random() * 18,
      }))
      setDrops((prev) => [...prev, ...batch])
      const ids = new Set(batch.map((b) => b.id))
      setTimeout(() => setDrops((prev) => prev.filter((d) => !ids.has(d.id))), 5200)
    }
    window.addEventListener('couple-fx', onFx)
    return () => window.removeEventListener('couple-fx', onFx)
  }, [])

  if (drops.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {drops.map((d) => (
        <span
          key={d.id}
          className="absolute top-0"
          style={{
            left: `${d.left}%`,
            fontSize: d.size,
            animation: `effect-fall ${d.dur}s linear ${d.delay}s both`,
          }}
        >
          {d.emoji}
        </span>
      ))}
    </div>
  )
}
