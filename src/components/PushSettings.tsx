import { useCallback, useEffect, useState } from 'react'
import {
  getExistingSubscription,
  pushConfigured,
  pushSupported,
  subscribePush,
  unsubscribePush,
} from '../lib/push'
import { t } from '../lib/i18n'

type PushState = 'loading' | 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on'

/** 「新消息通知」设置卡:检测支持情况,开启/关闭本设备的推送 */
export default function PushSettings({
  coupleId,
  userId,
  isIOS,
  isStandalone,
  onToast,
}: {
  coupleId: string
  userId: string
  isIOS: boolean
  isStandalone: boolean
  onToast: (msg: string) => void
}) {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)

  const check = useCallback(async () => {
    if (!pushSupported()) {
      setState('unsupported')
      return
    }
    if (!pushConfigured) {
      setState('unconfigured')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    const sub = await getExistingSubscription()
    setState(sub ? 'on' : 'off')
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  const toggle = async () => {
    if (busy || (state !== 'on' && state !== 'off')) return
    setBusy(true)
    try {
      if (state === 'on') {
        await unsubscribePush()
        setState('off')
        onToast(t('已关闭本设备的新消息通知'))
      } else {
        await subscribePush(coupleId, userId)
        setState('on')
        onToast(t('已开启新消息通知 🔔'))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('PERMISSION_DENIED')) setState('denied')
      else {
        onToast(t('操作失败,请重试'))
        await check()
      }
    } finally {
      setBusy(false)
    }
  }

  const statusText = (() => {
    switch (state) {
      case 'unsupported':
        return isIOS && !isStandalone
          ? t('需要先「添加到主屏幕」,再从主屏幕图标打开才能开启通知')
          : t('这个浏览器不支持推送通知(华为自带浏览器通常不支持,可尝试其他浏览器)')
      case 'unconfigured':
        return t('推送服务尚未配置完成(缺少 VAPID 公钥环境变量)')
      case 'denied':
        return t('通知权限被拒绝了:请到系统设置 → 浏览器/本应用 → 允许通知,然后回来重试')
      case 'on':
        return t('App 关闭时,对方发来的消息会弹出系统通知')
      case 'off':
        return t('开启后,App 关闭时也能收到对方的新消息提醒')
      default:
        return t('检测中…')
    }
  })()

  return (
    <div className="mt-4 rounded-2xl bg-white p-5">
      <div className="flex items-center justify-between">
        <span>{t('🔔 新消息通知')}</span>
        {(state === 'on' || state === 'off') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggle()}
            className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${
              state === 'on' ? 'bg-gray-100 text-gray-500' : 'bg-primary text-white'
            }`}
          >
            {busy ? t('请稍候…') : state === 'on' ? t('关闭') : t('开启')}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-400">{statusText}</p>
    </div>
  )
}
