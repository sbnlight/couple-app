import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Couple } from '../types/db'
import { t } from '../lib/i18n'

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

  const toggle = async (key: string) => {
    if (busy) return
    setBusy(true)
    try {
      const flags = couple.feature_flags ?? {}
      const next = { ...flags, [key]: !(flags[key] !== false) }
      const { error } = await supabase
        .from('couples')
        .update({ feature_flags: next })
        .eq('id', couple.id)
      if (error) throw error
      await onChanged()
    } catch {
      onToast(t('保存失败,请重试'))
    } finally {
      setBusy(false)
    }
  }

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

        <button
          type="button"
          className="mt-2 w-full border-t border-line py-3 text-center text-gray-500"
          onClick={onClose}
        >
          {t('完成')}
        </button>
      </div>
    </div>
  )
}
