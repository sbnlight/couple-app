import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry, friendlyWriteError } from '../lib/net'
import type { Couple } from '../types/db'
import { DAY_TIMEZONES } from '../lib/time'
import { t } from '../lib/i18n'

/** 读取小屋共用的「换日时区」(缺省 UTC) */
export function dayTzOf(couple: Couple | null): string {
  const v = couple?.feature_flags?.day_tz
  return typeof v === 'string' ? v : 'UTC'
}

/** 可开关的互动功能定义 */
export const FEATURE_DEFS = [
  { key: 'daily_qa', label: '💬 每日一问', desc: '每天一道问题,互相回答' },
  { key: 'checkin', label: '📍 每日打卡', desc: '每天一卡,记录连续天数' },
  { key: 'miss', label: '💭 想 TA 按钮', desc: '一键告诉对方你在想念' },
] as const

/** 某功能是否开启(缺省=开启) */
export function featureOn(couple: Couple | null, key: string): boolean {
  return couple?.feature_flags?.[key] !== false
}

/**
 * 功能开关(底部弹层)。开关是小屋级共同设置:
 * 任一方修改,双方同时生效;双方都可以随时改回来。
 */
export default function FeatureToggles({
  couple,
  onChanged,
  onClose,
  onToast,
}: {
  couple: Couple
  onChanged: () => Promise<void>
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const [busy, setBusy] = useState(false)

  /**
   * 读-改-写单个/多个开关字段。关键:写入前先从数据库取最新 feature_flags 再合并,
   * 而不是用组件手里的 couple 快照(可能已被对方改过其他字段)。这样两人同时改
   * 不同字段(如一方改开关、一方改换日时区)不会互相覆盖。
   * compute 接收最新 flags,返回要合并进去的补丁。
   */
  const patchFlags = async (compute: (fresh: Record<string, boolean | string>) => Record<string, boolean | string>) => {
    if (busy) return false
    setBusy(true)
    try {
      // 读-改-写是幂等的,弱网可安全重试;读失败必须中止以免覆盖对方的设置
      await withRetry(async () => {
        const { data, error: readErr } = await supabase
          .from('couples')
          .select('feature_flags')
          .eq('id', couple.id)
          .single()
        if (readErr) throw readErr
        const fresh = (data?.feature_flags as Record<string, boolean | string> | null) ?? {}
        const next = { ...fresh, ...compute(fresh) }
        const { error } = await supabase
          .from('couples')
          .update({ feature_flags: next })
          .eq('id', couple.id)
        if (error) throw error
      })
    } catch (e) {
      onToast(friendlyWriteError(e))
      return false
    } finally {
      setBusy(false)
    }
    void onChanged() // 刷新 best-effort,不影响本次成功
    return true
  }

  const toggle = async (key: string) => {
    await patchFlags((fresh) => ({ [key]: !(fresh[key] !== false) }))
  }

  const setDayTz = async (tz: string) => {
    const ok = await patchFlags(() => ({ day_tz: tz }))
    if (ok) onToast(t('换日时区已更新'))
  }

  const curTz = dayTzOf(couple)

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-md rounded-t-2xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 text-center text-sm font-medium text-gray-500">{t('功能开关')}</p>
        <p className="mb-3 text-center text-xs text-gray-300">
          {t('这是你们俩的共同设置:任一方修改,双方同时生效')}
        </p>

        <div className="divide-y divide-line">
          {FEATURE_DEFS.map((f) => {
            const on = featureOn(couple, f.key)
            return (
              <div key={f.key} className="flex items-center gap-3 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{t(f.label)}</span>
                  <span className="block text-xs text-gray-400">{t(f.desc)}</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggle(f.key)}
                  aria-label={`${on ? '关闭' : '开启'}${f.label}`}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                    on ? 'bg-primary' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      on ? 'left-[1.45rem]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </div>

        {/* 换日时区(两人共用) */}
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-sm font-medium text-gray-600">{t('「今天」的时区')}</p>
          <p className="mb-2 text-xs text-gray-400">
            {t('决定每日一问 / 打卡几点换新一天(两人共用)')}
          </p>
          <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {DAY_TIMEZONES.map((z) => (
              <button
                key={z.id}
                type="button"
                disabled={busy}
                onClick={() => void setDayTz(z.id)}
                className={`rounded-xl border py-2 text-xs transition-colors disabled:opacity-60 ${
                  curTz === z.id
                    ? 'border-primary bg-soft font-medium text-primary-dark'
                    : 'border-line text-gray-500'
                }`}
              >
                {t(z.label)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="mt-4 w-full border-t border-line py-3 text-center text-gray-500"
          onClick={onClose}
        >
          {t('完成')}
        </button>
      </div>
    </div>
  )
}
