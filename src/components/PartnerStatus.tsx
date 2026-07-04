import { useEffect, useState } from 'react'
import Portal from './Portal'
import { timeInZone } from '../lib/time'
import {
  cityLabelForTz,
  weatherDetailForCoords,
  weatherDetailForTz,
} from '../lib/weather'
import type { WeatherDetail } from '../lib/weather'
import { moodValid } from './MoodCard'
import type { Profile } from '../types/db'
import { t } from '../lib/i18n'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/**
 * 「对方近况」居中弹层:点聊天顶栏打开。
 * 显示对方当地的具体时间、详细天气(当前 + 未来几天最高/最低)、今日心情(含备注全文)。
 */
export default function PartnerStatus({
  partner,
  onClose,
}: {
  partner: Profile | null
  onClose: () => void
}) {
  const [detail, setDetail] = useState<WeatherDetail | null>(null)
  const [loadingW, setLoadingW] = useState(true)
  const tz = partner?.timezone ?? null
  const city = partner?.city ?? cityLabelForTz(tz)
  const name = partner?.display_name ?? t('TA')

  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    const p =
      partner?.lat != null && partner?.lng != null
        ? weatherDetailForCoords(partner.lat, partner.lng)
        : weatherDetailForTz(tz)
    setLoadingW(true)
    void p.then((d) => {
      if (!cancelled) {
        setDetail(d)
        setLoadingW(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [partner?.lat, partner?.lng, tz])

  const time = timeInZone(tz)
  const mood = moodValid(partner)
  const weekday = (dateStr: string) => WEEKDAYS[new Date(`${dateStr}T00:00:00`).getDay()]

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-6"
        onClick={onClose}
      >
        <div
          className="modal-pop w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-center text-base font-semibold text-primary-dark">
            {t('{name}的近况', { name })}
          </p>

          {/* 当地时间 */}
          <div className="mt-4 rounded-2xl bg-gradient-to-b from-rose-50 to-pink-50 p-4 text-center">
            <p className="text-xs text-gray-400">
              {city ? t('{c} · 当地时间', { c: city }) : t('TA 当地时间')}
            </p>
            <p className="mt-1 text-3xl font-bold text-primary-dark">
              {time ? time.hm : '—'}{' '}
              <span className="text-sm font-normal text-gray-400">
                {time ? (time.night ? t('🌙 夜晚') : t('☀️ 白天')) : ''}
              </span>
            </p>
          </div>

          {/* 详细天气 */}
          <div className="mt-3 rounded-2xl bg-gray-50 p-4">
            <p className="text-xs text-gray-400">{t('天气')}</p>
            {loadingW ? (
              <p className="mt-1 text-sm text-gray-300">{t('加载中…')}</p>
            ) : detail ? (
              <>
                <p className="mt-1 text-2xl font-semibold">
                  {detail.emoji} {detail.temp}°
                </p>
                {detail.daily.length > 0 && (
                  <div className="mt-3 flex justify-between gap-1">
                    {detail.daily.slice(0, 5).map((d, i) => (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-0.5">
                        <span className="text-[10px] text-gray-400">
                          {i === 0 ? t('今天') : weekday(d.date)}
                        </span>
                        <span className="text-lg">{d.emoji}</span>
                        <span className="text-[11px] font-medium text-gray-600">{d.max}°</span>
                        <span className="text-[11px] text-gray-300">{d.min}°</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-300">{t('暂时拿不到天气')}</p>
            )}
          </div>

          {/* 今日心情(含备注全文) */}
          <div className="mt-3 rounded-2xl bg-gray-50 p-4">
            <p className="text-xs text-gray-400">{t('今日心情')}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {mood ? mood : t('TA 还没设置今天的心情')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-full py-2.5 text-sm text-gray-500"
          >
            {t('关闭')}
          </button>
        </div>
      </div>
    </Portal>
  )
}
