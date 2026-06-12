/**
 * 对方城市天气:由时区映射到代表城市坐标,查 open-meteo(免费、无需密钥)。
 * 结果缓存 30 分钟;映射不到或请求失败时返回 null(界面不显示)。
 */

const TZ_COORDS: Record<string, [number, number]> = {
  'Asia/Shanghai': [31.23, 121.47],
  'Asia/Chongqing': [29.56, 106.55],
  'Asia/Urumqi': [43.83, 87.62],
  'Asia/Hong_Kong': [22.32, 114.17],
  'Asia/Macau': [22.2, 113.55],
  'Asia/Taipei': [25.03, 121.57],
  'Asia/Tokyo': [35.68, 139.69],
  'Asia/Seoul': [37.57, 126.98],
  'Asia/Singapore': [1.35, 103.82],
  'Asia/Bangkok': [13.76, 100.5],
  'Asia/Kolkata': [28.61, 77.21],
  'Asia/Dubai': [25.2, 55.27],
  'America/Los_Angeles': [34.05, -118.24],
  'America/Vancouver': [49.28, -123.12],
  'America/Phoenix': [33.45, -112.07],
  'America/Denver': [39.74, -104.99],
  'America/Chicago': [41.88, -87.63],
  'America/New_York': [40.71, -74.01],
  'America/Toronto': [43.65, -79.38],
  'America/Anchorage': [61.22, -149.9],
  'Pacific/Honolulu': [21.31, -157.86],
  'Europe/London': [51.51, -0.13],
  'Europe/Paris': [48.86, 2.35],
  'Europe/Berlin': [52.52, 13.41],
  'Europe/Amsterdam': [52.37, 4.9],
  'Europe/Madrid': [40.42, -3.7],
  'Europe/Rome': [41.9, 12.5],
  'Europe/Moscow': [55.76, 37.62],
  'Australia/Sydney': [-33.87, 151.21],
  'Australia/Melbourne': [-37.81, 144.96],
  'Australia/Perth': [-31.95, 115.86],
}

/** WMO 天气代码 → emoji */
function codeEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫'
  if (code <= 57) return '🌦'
  if (code <= 67) return '🌧'
  if (code <= 77) return '🌨'
  if (code <= 82) return '🌧'
  if (code <= 86) return '❄️'
  return '⛈'
}

const cache = new Map<string, { at: number; value: { emoji: string; temp: number } | null }>()

export async function weatherForTz(
  tz: string | null,
): Promise<{ emoji: string; temp: number } | null> {
  if (!tz) return null
  const coords = TZ_COORDS[tz]
  if (!coords) return null
  const hit = cache.get(tz)
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.value
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords[0]}&longitude=${coords[1]}&current=temperature_2m,weather_code`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined },
    )
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number }
    }
    const cur = json.current
    const value =
      cur && typeof cur.temperature_2m === 'number'
        ? { emoji: codeEmoji(cur.weather_code ?? 3), temp: Math.round(cur.temperature_2m) }
        : null
    cache.set(tz, { at: Date.now(), value })
    return value
  } catch {
    cache.set(tz, { at: Date.now(), value: null })
    return null
  }
}
