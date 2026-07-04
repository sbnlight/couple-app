import { useEffect, useState } from 'react'
import { timeInZone } from '../lib/time'
import { t } from '../lib/i18n'

/** 对方当地时间(每 30 秒刷新);时区未知时不渲染 */
export default function PartnerClock({
  tz,
  prefix,
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
  // 只在夜里显示 🌙(表示"那边是晚上");白天不显示☀️——避免和旁边的天气图标(如☁️多云)打架
  return (
    <>
      {prefix ?? t('TA那边现在')} {info.hm} {info.night ? '🌙' : ''}
    </>
  )
}
