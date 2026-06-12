import { useEffect, useState } from 'react'
import { timeInZone } from '../lib/time'

/** 对方当地时间(每 30 秒刷新);时区未知时不渲染 */
export default function PartnerClock({
  tz,
  prefix = 'TA那边现在',
}: {
  tz: string | null | undefined
  prefix?: string
}) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const info = timeInZone(tz ?? null)
  if (!info) return null
  return (
    <>
      {prefix} {info.hm} {info.night ? '🌙' : '☀️'}
    </>
  )
}
