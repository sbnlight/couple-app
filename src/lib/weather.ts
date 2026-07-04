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

/** 时区 → 代表城市中文名(双城卡片显示;查不到则用时区最后一段) */
const TZ_CITY: Record<string, string> = {
  'Asia/Shanghai': '上海',
  'Asia/Chongqing': '重庆',
  'Asia/Urumqi': '乌鲁木齐',
  'Asia/Hong_Kong': '香港',
  'Asia/Macau': '澳门',
  'Asia/Taipei': '台北',
  'Asia/Tokyo': '东京',
  'Asia/Seoul': '首尔',
  'Asia/Singapore': '新加坡',
  'Asia/Bangkok': '曼谷',
  'Asia/Kolkata': '新德里',
  'Asia/Dubai': '迪拜',
  'America/Los_Angeles': '洛杉矶',
  'America/Vancouver': '温哥华',
  'America/Phoenix': '凤凰城',
  'America/Denver': '丹佛',
  'America/Chicago': '芝加哥',
  'America/New_York': '纽约',
  'America/Toronto': '多伦多',
  'America/Anchorage': '安克雷奇',
  'Pacific/Honolulu': '檀香山',
  'Europe/London': '伦敦',
  'Europe/Paris': '巴黎',
  'Europe/Berlin': '柏林',
  'Europe/Amsterdam': '阿姆斯特丹',
  'Europe/Madrid': '马德里',
  'Europe/Rome': '罗马',
  'Europe/Moscow': '莫斯科',
  'Australia/Sydney': '悉尼',
  'Australia/Melbourne': '墨尔本',
  'Australia/Perth': '珀斯',
}

/** 时区对应的城市名(查不到用时区最后一段,下划线转空格) */
export function cityLabelForTz(tz: string | null): string | null {
  if (!tz) return null
  return TZ_CITY[tz] ?? tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
}

/** 两点经纬度之间的直线距离(公里,四舍五入) */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s))))
}

/** 两个时区代表城市之间的直线距离(公里,精确坐标缺失时的回退);查不到返回 null */
export function distanceKm(tzA: string | null, tzB: string | null): number | null {
  if (!tzA || !tzB) return null
  const a = TZ_COORDS[tzA]
  const b = TZ_COORDS[tzB]
  if (!a || !b) return null
  return haversineKm(a[0], a[1], b[0], b[1])
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

/** 按精确经纬度取当前天气(open-meteo,免费无密钥);缓存 30 分钟 */
export async function weatherForCoords(
  lat: number,
  lng: number,
): Promise<{ emoji: string; temp: number } | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.value
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`,
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
    cache.set(key, { at: Date.now(), value })
    return value
  } catch {
    cache.set(key, { at: Date.now(), value: null })
    return null
  }
}

/** 按时区代表城市取天气(精确坐标缺失时的回退) */
export async function weatherForTz(
  tz: string | null,
): Promise<{ emoji: string; temp: number } | null> {
  if (!tz) return null
  const coords = TZ_COORDS[tz]
  if (!coords) return null
  return weatherForCoords(coords[0], coords[1])
}

/** 浏览器定位坐标 → 具体城市名(BigDataCloud 免费逆地理编码,无需密钥、支持中文) */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=zh`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined },
    )
    const j = (await res.json()) as {
      city?: string
      locality?: string
      principalSubdivision?: string
    }
    return j.city || j.locality || j.principalSubdivision || null
  } catch {
    return null
  }
}

export interface CityHit {
  name: string
  lat: number
  lng: number
  region?: string
  country?: string
}

/** 城市名搜索 → 候选城市(open-meteo geocoding,免费无密钥) */
export async function searchCity(name: string): Promise<CityHit[]> {
  const q = name.trim()
  if (!q) return []
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=zh&format=json`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined },
    )
    const j = (await res.json()) as {
      results?: {
        name: string
        latitude: number
        longitude: number
        admin1?: string
        country?: string
      }[]
    }
    return (j.results ?? []).map((r) => ({
      name: r.name,
      lat: r.latitude,
      lng: r.longitude,
      region: r.admin1,
      country: r.country,
    }))
  } catch {
    return []
  }
}
