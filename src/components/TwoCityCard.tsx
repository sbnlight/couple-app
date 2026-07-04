import { useEffect, useState } from 'react'
import { cityLabelForTz, distanceKm, haversineKm, weatherForCoords, weatherForTz } from '../lib/weather'
import { t } from '../lib/i18n'

type W = { emoji: string; temp: number } | null

/** 一个人的位置:时区(决定时间)+ 可选精确城市与经纬度(决定城市名/天气/距离) */
export interface Loc {
  tz: string | null
  city: string | null
  lat: number | null
  lng: number | null
}

/** 取某时区当前 HH:mm */
function timeInTz(tz: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date())
  } catch {
    return ''
  }
}

/** 取某时区当前小时(判断白天/夜晚:6–18 视为白天) */
function hourInTz(tz: string): number {
  try {
    const h = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      hour12: false,
    }).format(new Date())
    return Number(h) % 24
  } catch {
    return 12
  }
}

function CityCol({
  tz,
  name,
  lat,
  lng,
  mine,
}: {
  tz: string
  name: string
  lat: number | null
  lng: number | null
  mine: boolean
}) {
  const [time, setTime] = useState(() => timeInTz(tz))
  const [weather, setWeather] = useState<W>(null)

  useEffect(() => {
    setTime(timeInTz(tz))
    const timer = setInterval(() => setTime(timeInTz(tz)), 30_000)
    return () => clearInterval(timer)
  }, [tz])

  useEffect(() => {
    let cancelled = false
    // 有精确坐标就按坐标查天气,否则回退按时区代表城市
    const p = lat != null && lng != null ? weatherForCoords(lat, lng) : weatherForTz(tz)
    void p.then((w) => {
      if (!cancelled) setWeather(w)
    })
    return () => {
      cancelled = true
    }
  }, [tz, lat, lng])

  const hr = hourInTz(tz)
  const phase = hr >= 6 && hr < 17 ? 'day' : hr >= 17 && hr < 20 ? 'dusk' : 'night'
  const scene = phase === 'day' ? '🌇' : phase === 'dusk' ? '🌆' : '🌃'
  // 按当地时段给场景一抹底色(白天暖蓝 / 黄昏橙粉 / 夜晚靛蓝)
  const tint =
    phase === 'day'
      ? 'from-sky-100 to-white'
      : phase === 'dusk'
        ? 'from-orange-100 to-rose-50'
        : 'from-indigo-100 to-slate-50'
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b ${tint} text-2xl`}
      >
        {scene}
      </span>
      <span className="max-w-full truncate text-sm font-medium text-gray-600">
        {name}
        {mine ? t('(你)') : ''}
      </span>
      <span className="text-lg font-semibold tabular-nums text-primary-dark">{time}</span>
      <span className="text-xs text-gray-400">
        {weather
          ? `${weather.emoji} ${weather.temp}°`
          : phase === 'day'
            ? t('白天')
            : phase === 'dusk'
              ? t('黄昏')
              : t('夜晚')}
      </span>
    </div>
  )
}

/**
 * 双城卡片(异地专属):并排显示两人所在城市的当地时间、天气,中间是相距公里数。
 * 城市名/天气/距离优先用各自设置的精确位置(profiles.city/lat/lng),未设置则回退按时区。
 * 时间始终按时区显示。两人在同一时区且同城则不显示。
 */
export default function TwoCityCard({ me, partner }: { me: Loc; partner: Loc }) {
  const myCity = me.city ?? cityLabelForTz(me.tz)
  const partnerCity = partner.city ?? cityLabelForTz(partner.tz)
  // 完全同一地点(同时区且同城/都没设城市)才隐藏;同时区不同城仍显示
  const sameSpot = me.tz === partner.tz && (me.city ?? '') === (partner.city ?? '')
  if (!me.tz || !partner.tz || sameSpot || !myCity || !partnerCity) return null
  const km =
    me.lat != null && me.lng != null && partner.lat != null && partner.lng != null
      ? haversineKm(me.lat, me.lng, partner.lat, partner.lng)
      : distanceKm(me.tz, partner.tz)

  return (
    <div className="relative mt-4 overflow-hidden rounded-2xl bg-white p-5">
      {/* 两城之间的飞行连线:流动虚线弧 + 沿弧飞的小飞机(异地也心连心) */}
      <div className="pointer-events-none absolute inset-x-10 top-3 h-10">
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-full w-full">
          <path
            d="M2 24 Q50 2 98 24"
            fill="none"
            stroke="#fbcfe8"
            strokeWidth="1.4"
            strokeLinecap="round"
            className="city-dash"
          />
          <circle cx="2" cy="24" r="2.2" fill="#fb7185" />
          <circle cx="98" cy="24" r="2.2" fill="#fb7185" />
        </svg>
        <span className="city-plane text-sm">✈️</span>
      </div>

      <div className="relative flex items-center gap-2">
        <CityCol tz={me.tz} name={myCity} lat={me.lat} lng={me.lng} mine />
        <div className="flex flex-col items-center px-1 text-center">
          <span className="bubble-beat inline-block text-lg">❤️</span>
          {km !== null && (
            <span className="whitespace-nowrap text-xs text-gray-400">
              {t('相距 {n} 公里', { n: km.toLocaleString() })}
            </span>
          )}
        </div>
        <CityCol tz={partner.tz} name={partnerCity} lat={partner.lat} lng={partner.lng} mine={false} />
      </div>
    </div>
  )
}
