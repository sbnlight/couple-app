import { useEffect, useRef, useState } from 'react'
import { onLive, sendLive } from '../lib/live'
import { t } from '../lib/i18n'

/**
 * 实时触碰(Thumbkiss,异地专属):
 * 按住屏幕中央的心 → 广播"我在触碰";当两人同时按住时,双端持续震动 + 心跳放大发光,
 * 像隔空触到对方。松手即断开。纯 Realtime Broadcast,不落库。
 *
 * 说明:iOS Safari 目前不支持 navigator.vibrate,震动仅安卓/鸿蒙可感;
 * 视觉反馈(放大 + 光晕 + "已连接")两端都有。
 */
export default function Thumbkiss({ onClose }: { onClose: () => void }) {
  const [myTouch, setMyTouch] = useState(false)
  const [partnerTouch, setPartnerTouch] = useState(false)
  const [partnerPresent, setPartnerPresent] = useState(false)
  const vibratingRef = useRef(false)

  useEffect(() => {
    const off = onLive('touch', (p) => setPartnerTouch(Boolean(p.on)))
    return () => {
      off()
      // 退出时告诉对方我松手了
      sendLive('touch', { on: false })
    }
  }, [])

  // 收到过对方触碰 → 视为 TA 也在这个页面
  useEffect(() => {
    if (partnerTouch) setPartnerPresent(true)
  }, [partnerTouch])

  const connected = myTouch && partnerTouch

  // 双方同时触碰 → 持续心跳震动(可用则震)
  useEffect(() => {
    if (connected && !vibratingRef.current) {
      vibratingRef.current = true
      const beat = () => {
        if (!vibratingRef.current) return
        navigator.vibrate?.([40, 120, 40])
      }
      beat()
      const timer = setInterval(beat, 900)
      return () => {
        clearInterval(timer)
        vibratingRef.current = false
        navigator.vibrate?.(0)
      }
    }
  }, [connected])

  const press = () => {
    setMyTouch(true)
    sendLive('touch', { on: true })
  }
  const release = () => {
    setMyTouch(false)
    sendLive('touch', { on: false })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-rose-50 to-pink-100 px-8">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] text-sm text-gray-400"
      >
        {t('关闭')}
      </button>

      <p className="mb-2 text-center text-sm text-gray-500">
        {connected
          ? t('心连上啦,感受到 TA 了吗 💞')
          : myTouch
            ? t('按住不放,等 TA 也按住…')
            : t('按住下面的心,和 TA 同时触碰')}
      </p>

      <button
        type="button"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          press()
        }}
        onPointerUp={release}
        onPointerCancel={release}
        aria-label="按住触碰"
        style={{ touchAction: 'none' }}
        className={`relative flex h-56 w-56 select-none items-center justify-center rounded-full transition-all duration-300 ${
          connected
            ? 'scale-110 bg-rose-300 shadow-[0_0_60px_20px_rgba(244,114,182,0.7)]'
            : myTouch
              ? 'scale-105 bg-rose-200 shadow-[0_0_40px_10px_rgba(251,113,133,0.4)]'
              : 'bg-white shadow-lg'
        }`}
      >
        <span className={`text-7xl ${connected ? 'animate-pulse' : ''}`}>
          {connected ? '💗' : '🤍'}
        </span>
      </button>

      <div className="mt-6 flex gap-8 text-center text-xs">
        <span className={myTouch ? 'text-rose-500' : 'text-gray-300'}>
          {t('你')} {myTouch ? '●' : '○'}
        </span>
        <span className={partnerTouch ? 'text-rose-500' : 'text-gray-300'}>
          {t('TA')} {partnerTouch ? '●' : '○'}
        </span>
      </div>
      {!partnerPresent && (
        <p className="mt-4 text-center text-xs text-gray-300">
          {t('TA 不在线时,可以先按住等 TA 来~')}
        </p>
      )}
    </div>
  )
}
