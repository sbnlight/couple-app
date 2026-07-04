import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry, friendlyWriteError } from '../lib/net'
import { cityLabelForTz, reverseGeocode, searchCity } from '../lib/weather'
import type { CityHit } from '../lib/weather'
import { t } from '../lib/i18n'

/**
 * 「我的位置」设置(底部弹层):把位置精确到具体城市。
 * - 一键使用当前位置(浏览器定位 → BigDataCloud 逆地理编码取城市名)
 * - 或手动搜索城市(open-meteo geocoding)
 * 结果(city + 经纬度)存进 profiles 并共享给对方;双城卡片的城市名/天气/距离改用精确坐标。
 * 时间仍按时区显示(同一时区内城市时间相同)。全部免费、无需密钥。
 */
export default function LocationSetting({
  userId,
  city,
  tz,
  onSaved,
  onClose,
}: {
  userId: string
  city: string | null
  tz: string | null
  onSaved: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CityHit[]>([])
  const [searching, setSearching] = useState(false)

  const save = async (patch: { city: string | null; lat: number | null; lng: number | null }) => {
    setBusy(true)
    setErr('')
    try {
      await withRetry(async () => {
        const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
        if (error) throw error
      })
    } catch (e) {
      setErr(friendlyWriteError(e))
      setBusy(false)
      return
    }
    setBusy(false)
    void onSaved()
    onClose()
  }

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setErr(t('这台设备不支持定位,请手动搜索城市'))
      return
    }
    setBusy(true)
    setErr('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const name = await reverseGeocode(latitude, longitude)
        await save({ city: name ?? t('我的位置'), lat: latitude, lng: longitude })
      },
      () => {
        setBusy(false)
        setErr(t('定位失败或被拒绝,可改用下面的搜索'))
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }

  const doSearch = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setErr('')
    setResults(await searchCity(query))
    setSearching(false)
  }

  const tzLabel = cityLabelForTz(tz)
  const currentText = city
    ? city
    : tzLabel
      ? t('{c}(按时区)', { c: tzLabel })
      : t('未设置')

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-center text-sm font-medium text-gray-500">{t('📍 我的位置')}</p>
        <p className="mb-3 text-center text-xs text-gray-400">
          {t('当前:')}
          {currentText}
        </p>

        <button
          type="button"
          disabled={busy}
          onClick={useCurrentLocation}
          className="btn-primary w-full rounded-full py-3 disabled:opacity-60"
        >
          {busy ? t('定位中…') : t('使用当前位置')}
        </button>

        <div className="mt-4 flex gap-2">
          <input
            className="input min-w-0 flex-1 py-2"
            type="text"
            placeholder={t('搜索城市,如:西雅图 / Seattle')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSearch()
            }}
          />
          <button
            type="button"
            onClick={() => void doSearch()}
            className="shrink-0 rounded-lg bg-soft px-4 text-sm text-primary-dark"
          >
            {t('搜索')}
          </button>
        </div>

        {searching && <p className="mt-2 text-center text-xs text-gray-300">{t('搜索中…')}</p>}
        {results.length > 0 && (
          <div className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => void save({ city: r.name, lat: r.lat, lng: r.lng })}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm active:bg-soft"
              >
                <span>{r.name}</span>
                <span className="ml-2 shrink-0 text-xs text-gray-400">
                  {[r.region, r.country].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        )}

        {err && <p className="mt-2 text-center text-xs text-red-500">{err}</p>}

        <div className="mt-4 flex gap-3">
          {city && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save({ city: null, lat: null, lng: null })}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm text-gray-500"
            >
              {t('恢复按时区')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm text-gray-500"
          >
            {t('完成')}
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray-300">
          {t('位置会分享给对方(用于双城卡片的城市与天气);时间仍按时区显示。')}
        </p>
      </div>
    </div>
  )
}
