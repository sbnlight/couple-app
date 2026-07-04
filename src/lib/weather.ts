/**
 * 对方城市天气:由时区映射到代表城市坐标,查 open-meteo(免费、无需密钥)。
 * 结果缓存 30 秒;映射不到或请求失败时返回 null(界面不显示)。
 */

/** 8s 超时信号:新环境用 AbortSignal.timeout;老 iOS Safari 缺该 API 时用 AbortController 兜底 */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms)
  const c = new AbortController()
  setTimeout(() => c.abort(), ms)
  return c.signal
}

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
  'Asia/Jakarta': [-6.21, 106.85],
  'Asia/Manila': [14.6, 120.98],
  'Asia/Kuala_Lumpur': [3.14, 101.69],
  'Asia/Ho_Chi_Minh': [10.82, 106.63],
  'Asia/Karachi': [24.86, 67.0],
  'Asia/Jerusalem': [31.77, 35.21],
  'America/Los_Angeles': [34.05, -118.24],
  'America/Vancouver': [49.28, -123.12],
  'America/Phoenix': [33.45, -112.07],
  'America/Denver': [39.74, -104.99],
  'America/Chicago': [41.88, -87.63],
  'America/New_York': [40.71, -74.01],
  'America/Toronto': [43.65, -79.38],
  'America/Halifax': [44.65, -63.57],
  'America/Mexico_City': [19.43, -99.13],
  'America/Bogota': [4.71, -74.07],
  'America/Sao_Paulo': [-23.55, -46.63],
  'America/Anchorage': [61.22, -149.9],
  'Pacific/Honolulu': [21.31, -157.86],
  'Pacific/Auckland': [-36.85, 174.76],
  'Europe/London': [51.51, -0.13],
  'Europe/Paris': [48.86, 2.35],
  'Europe/Berlin': [52.52, 13.41],
  'Europe/Amsterdam': [52.37, 4.9],
  'Europe/Madrid': [40.42, -3.7],
  'Europe/Rome': [41.9, 12.5],
  'Europe/Zurich': [47.37, 8.54],
  'Europe/Stockholm': [59.33, 18.07],
  'Europe/Istanbul': [41.01, 28.98],
  'Europe/Moscow': [55.76, 37.62],
  'Africa/Cairo': [30.04, 31.24],
  'Africa/Johannesburg': [-26.2, 28.05],
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
  'Asia/Jakarta': '雅加达',
  'Asia/Manila': '马尼拉',
  'Asia/Kuala_Lumpur': '吉隆坡',
  'Asia/Ho_Chi_Minh': '胡志明市',
  'Asia/Karachi': '卡拉奇',
  'Asia/Jerusalem': '耶路撒冷',
  'America/Los_Angeles': '洛杉矶',
  'America/Vancouver': '温哥华',
  'America/Phoenix': '凤凰城',
  'America/Denver': '丹佛',
  'America/Chicago': '芝加哥',
  'America/New_York': '纽约',
  'America/Toronto': '多伦多',
  'America/Halifax': '哈利法克斯',
  'America/Mexico_City': '墨西哥城',
  'America/Bogota': '波哥大',
  'America/Sao_Paulo': '圣保罗',
  'America/Anchorage': '安克雷奇',
  'Pacific/Honolulu': '檀香山',
  'Pacific/Auckland': '奥克兰',
  'Europe/London': '伦敦',
  'Europe/Paris': '巴黎',
  'Europe/Berlin': '柏林',
  'Europe/Amsterdam': '阿姆斯特丹',
  'Europe/Madrid': '马德里',
  'Europe/Rome': '罗马',
  'Europe/Zurich': '苏黎世',
  'Europe/Stockholm': '斯德哥尔摩',
  'Europe/Istanbul': '伊斯坦布尔',
  'Europe/Moscow': '莫斯科',
  'Africa/Cairo': '开罗',
  'Africa/Johannesburg': '约翰内斯堡',
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

// 天气缓存时长(秒级):配合前台每分钟自动刷新,让「对方天气」接近实时;同时对同一
// 坐标的密集调用去重,避免无谓请求。天气源本身约每小时更新,30 秒缓存已绰绰有余。
const CACHE_MS = 30_000
const cache = new Map<string, { at: number; value: { emoji: string; temp: number } | null }>()

/** 按精确经纬度取当前天气(open-meteo,免费无密钥);缓存 30 秒 */
export async function weatherForCoords(
  lat: number,
  lng: number,
): Promise<{ emoji: string; temp: number } | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`,
      { signal: timeoutSignal(8000) },
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

export interface WeatherDaily {
  date: string
  max: number
  min: number
  emoji: string
}
export interface WeatherDetail {
  emoji: string
  temp: number
  daily: WeatherDaily[]
}

const detailCache = new Map<string, { at: number; value: WeatherDetail | null }>()

/** 详细天气(当前 + 未来 5 天最高/最低/天气);缓存 30 秒。给"点开看详情"用。 */
export async function weatherDetailForCoords(lat: number, lng: number): Promise<WeatherDetail | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const hit = detailCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=auto`,
      { signal: timeoutSignal(8000) },
    )
    const j = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number }
      daily?: {
        time?: string[]
        weather_code?: number[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
      }
    }
    const cur = j.current
    if (!cur || typeof cur.temperature_2m !== 'number') {
      detailCache.set(key, { at: Date.now(), value: null })
      return null
    }
    const d = j.daily
    const daily: WeatherDaily[] = []
    if (d?.time) {
      for (let i = 0; i < d.time.length; i++) {
        daily.push({
          date: d.time[i],
          max: Math.round(d.temperature_2m_max?.[i] ?? 0),
          min: Math.round(d.temperature_2m_min?.[i] ?? 0),
          emoji: codeEmoji(d.weather_code?.[i] ?? 3),
        })
      }
    }
    const value: WeatherDetail = {
      emoji: codeEmoji(cur.weather_code ?? 3),
      temp: Math.round(cur.temperature_2m),
      daily,
    }
    detailCache.set(key, { at: Date.now(), value })
    return value
  } catch {
    detailCache.set(key, { at: Date.now(), value: null })
    return null
  }
}

/** 按时区代表城市取详细天气(精确坐标缺失时的回退) */
export async function weatherDetailForTz(tz: string | null): Promise<WeatherDetail | null> {
  if (!tz) return null
  const coords = TZ_COORDS[tz]
  if (!coords) return null
  return weatherDetailForCoords(coords[0], coords[1])
}

/** 浏览器定位坐标 → 具体城市名(BigDataCloud 免费逆地理编码,无需密钥、支持中文) */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=zh`,
      { signal: timeoutSignal(8000) },
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
      { signal: timeoutSignal(8000) },
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
