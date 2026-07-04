import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry, friendlyWriteError } from '../lib/net'
import { cityLabelForTz, reverseGeocode, searchCity } from '../lib/weather'
import type { CityHit } from '../lib/weather'
import { t } from '../lib/i18n'
import { getAutoLocation, setAutoLocation } from '../lib/prefs'

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
  const [auto, setAuto] = useState(getAutoLocation())

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

  const captureCurrentLocation = () => {
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
          onClick={captureCurrentLocation}
          className="btn-primary w-full rounded-full py-3 disabled:opacity-60"
        >
          {busy ? t('定位中…') : t('使用当前位置')}
        </button>

        {/* 自动更新开关:开启即授权并定位一次,之后每次打开 App 自动刷新到精确城市 */}
        <button
          type="button"
          onClick={() => {
            const on = !auto
            setAuto(on)
            setAutoLocation(on)
            if (on) captureCurrentLocation()
          }}
          className={`mt-3 flex w-full items-center justify-between rounded-xl bg-soft px-4 py-3 text-left text-sm ${
            auto ? 'text-primary-dark' : 'text-gray-500'
          }`}
        >
          <span className="flex flex-col">
            <span>{t('自动更新我的位置')}</span>
            <span className="mt-0.5 text-xs text-gray-400">
              {t('授权一次,之后每次打开自动刷新到精确城市')}
            </span>
          </span>
          <span
            className="relative ml-3 h-5 w-9 shrink-0 rounded-full transition-colors"
            style={{ background: auto ? 'var(--c-primary)' : '#d1d5db' }}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                auto ? 'left-[1.125rem]' : 'left-0.5'
              }`}
            />
          </span>
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
        {/* 兜底:哪怕搜不到/连不上(国内网络),直接用手打的名字,城市名一定对。
            没坐标时天气/距离按时区回退,误差不大。 */}
        {query.trim() && !searching && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save({ city: query.trim(), lat: null, lng: null })}
            className="mt-2 w-full rounded-lg border border-dashed border-line py-2 text-xs text-gray-500 active:bg-soft"
          >
            {t('搜不到?直接用「{q}」作为城市名', { q: query.trim() })}
          </button>
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
