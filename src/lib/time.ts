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

/** 今天的 UTC 日期(YYYY-MM-DD) */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10)
}

/** UTC 日期字符串的前一天 */
export function prevUtcDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

/** 可选的「换日时区」(两人共用,决定每日一问/打卡几点翻新一天) */
export const DAY_TIMEZONES: { id: string; label: string }[] = [
  { id: 'UTC', label: 'UTC(默认)' },
  { id: 'Asia/Shanghai', label: '北京时间' },
  { id: 'America/Los_Angeles', label: '美西(洛杉矶)' },
  { id: 'America/New_York', label: '美东(纽约)' },
  { id: 'Asia/Tokyo', label: '日本(东京)' },
  { id: 'Europe/London', label: '英国(伦敦)' },
]

/**
 * 指定时区下「今天」的日期(YYYY-MM-DD)。
 * 每日一问/打卡用它替代 utcToday,保证两人按共用时区看到同一天。
 * tz 为空或 'UTC' 时退回 UTC。
 */
export function todayInTz(tz: string | null | undefined): string {
  if (!tz || tz === 'UTC') return utcToday()
  try {
    // en-CA 输出 YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
  } catch {
    return utcToday()
  }
}

/** 某时区在某瞬间的偏移(本地挂钟 - UTC,毫秒) */
function tzOffsetMs(date: Date, tz: string): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value)
  const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'))
  return asUTC - date.getTime()
}

/** 指定时区下「今天零点」对应的 UTC ISO(用于按日的时间戳统计边界) */
export function dayStartUtcISO(tz: string | null | undefined): string {
  const day = todayInTz(tz)
  if (!tz || tz === 'UTC') return `${day}T00:00:00.000Z`
  try {
    const guess = new Date(`${day}T00:00:00Z`)
    return new Date(guess.getTime() - tzOffsetMs(guess, tz)).toISOString()
  } catch {
    return `${day}T00:00:00.000Z`
  }
}
