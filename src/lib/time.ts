/** 时间相关小工具:异地时区显示与日期计算 */

/**
 * 「对方近况」前台自动刷新节奏:对方的天气、城市/坐标、时区、心情,以及双城卡片里
 * 由坐标算出的「相距 N 公里」,都按这个间隔自动同步。想改快/改慢只动这一个值。
 * 说明:天气数据源(open-meteo)本身约每小时才更新一次,刷得再勤多半是同一读数;
 * 城市/距离只有对方手动改了位置才会变——这里保证改动后约 1 分钟内两边就对上。
 */
export const LIVE_REFRESH_MS = 60 * 1000

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

/** 可选的「换日时区」(两人共用,决定每日一问/打卡几点翻新一天);默认 UTC */
export const DAY_TIMEZONES: { id: string; label: string }[] = [
  { id: 'UTC', label: 'UTC(默认)' },
  { id: 'Pacific/Midway', label: 'UTC-11 中途岛' },
  { id: 'Pacific/Honolulu', label: 'UTC-10 夏威夷' },
  { id: 'America/Anchorage', label: 'UTC-9 阿拉斯加' },
  { id: 'America/Los_Angeles', label: 'UTC-8 美西·洛杉矶' },
  { id: 'America/Denver', label: 'UTC-7 美山区·丹佛' },
  { id: 'America/Chicago', label: 'UTC-6 美中·芝加哥' },
  { id: 'America/New_York', label: 'UTC-5 美东·纽约' },
  { id: 'America/Halifax', label: 'UTC-4 大西洋' },
  { id: 'America/Sao_Paulo', label: 'UTC-3 圣保罗' },
  { id: 'Atlantic/South_Georgia', label: 'UTC-2 南乔治亚' },
  { id: 'Atlantic/Azores', label: 'UTC-1 亚速尔' },
  { id: 'Europe/London', label: 'UTC+0 伦敦' },
  { id: 'Europe/Paris', label: 'UTC+1 巴黎·柏林' },
  { id: 'Europe/Athens', label: 'UTC+2 雅典·开罗' },
  { id: 'Europe/Moscow', label: 'UTC+3 莫斯科' },
  { id: 'Asia/Dubai', label: 'UTC+4 迪拜' },
  { id: 'Asia/Karachi', label: 'UTC+5 卡拉奇' },
  { id: 'Asia/Kolkata', label: 'UTC+5:30 印度' },
  { id: 'Asia/Dhaka', label: 'UTC+6 达卡' },
  { id: 'Asia/Bangkok', label: 'UTC+7 曼谷' },
  { id: 'Asia/Shanghai', label: 'UTC+8 北京' },
  { id: 'Asia/Tokyo', label: 'UTC+9 东京' },
  { id: 'Australia/Sydney', label: 'UTC+10 悉尼' },
  { id: 'Pacific/Noumea', label: 'UTC+11 努美阿' },
  { id: 'Pacific/Auckland', label: 'UTC+12 奥克兰' },
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

/**
 * 指定时区下「今天零点」对应的 UTC ISO 时刻(按日的时间戳统计边界用)。
 * 例:Asia/Shanghai 的今天 2026-06-13 → 返回 2026-06-12T16:00:00Z。
 * 二次校正:先用 UTC 午夜估算偏移得到近似 UTC 时刻,再用该近似时刻的偏移
 * 重算一次,消除 DST 切换日「本地午夜与 UTC 午夜分属不同偏移」的 1 小时误差。
 */
export function dayStartUtcISO(tz: string | null | undefined): string {
  const day = todayInTz(tz)
  if (!tz || tz === 'UTC') return `${day}T00:00:00.000Z`
  try {
    const base = Date.parse(`${day}T00:00:00Z`)
    let utc = base - tzOffsetMs(new Date(base), tz)
    utc = base - tzOffsetMs(new Date(utc), tz)
    return new Date(utc).toISOString()
  } catch {
    return `${day}T00:00:00.000Z`
  }
}
