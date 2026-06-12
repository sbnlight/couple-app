/** 时间相关小工具:异地时区显示与日期计算 */

/** 某时区的当前时刻;tz 无效或为空返回 null */
export function timeInZone(tz: string | null): { hm: string; night: boolean } | null {
  if (!tz) return null
  try {
    const now = new Date()
    const hm = new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now)
    const hour = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(
        now,
      ),
    )
    return { hm, night: hour >= 22 || hour < 7 }
  } catch {
    return null
  }
}

/** 当前设备的 IANA 时区 */
export function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    return null
  }
}

/**
 * 目标日期(YYYY-MM-DD,按本地时区)距离今天的天数:
 * >0 未来还有 n 天;=0 就是今天;<0 已过去 n 天
 */
export function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - today) / 86_400_000)
}

/** 今天的 UTC 日期(YYYY-MM-DD)。每日一问/打卡统一用它,保证异地两人"同一天"一致 */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/** UTC 日期字符串的前一天 */
export function prevUtcDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}
