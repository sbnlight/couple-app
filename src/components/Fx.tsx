import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * 复用的绚丽小组件(M3):数字滚动 + 环境上浮装饰。
 * 原本内嵌在 YearReport,抽出来供恋爱大卡、记账等复用。
 */

/** 数字从 0 缓动滚到目标值(尊重「减弱动态」偏好则直接显示终值)。
 *  decimals>0 时按金额格式化(带千分位与小数)。 */
export function CountUp({
  value,
  run = true,
  duration = 1100,
  decimals = 0,
  prefix = '',
  suffix = '',
}: {
  value: number
  run?: boolean
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
}) {
  const [n, setN] = useState(run ? 0 : value)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!run || reduce) {
      setN(value)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setN(value * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setN(value)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, value, duration])
  const body =
    decimals > 0
      ? n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : Math.round(n).toLocaleString()
  return (
    <>
      {prefix}
      {body}
      {suffix}
    </>
  )
}

/** 缓缓上浮的装饰层(爱心/星星/彩纸等);放在 relative 容器内当氛围底。 */
export function FloatLayer({ items, count = 12 }: { items: string[]; count?: number }) {
  const drops = Array.from({ length: count }, (_, i) => ({
    key: i,
    e: items[i % items.length],
    left: (i * 37 + 11) % 100,
    dur: 7 + (i % 5),
    delay: -(i * 1.3),
    size: 15 + (i % 4) * 7,
    op: 0.25 + (i % 3) * 0.12,
  }))
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {drops.map((d) => (
        <span
          key={d.key}
          className="absolute bottom-0"
          style={{
            ...({ '--o': d.op } as CSSProperties),
            left: `${d.left}%`,
            fontSize: d.size,
            animation: `year-drift ${d.dur}s linear ${d.delay}s infinite`,
          }}
        >
          {d.e}
        </span>
      ))}
    </div>
  )
}
