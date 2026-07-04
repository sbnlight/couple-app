import { useEffect, useRef, useState } from 'react'
import { onLive, sendLive } from '../lib/live'
import { fireEffect } from '../lib/effects'
import { FloatLayer } from './Fx'
import { t } from '../lib/i18n'

/**
 * 实时触碰(Thumbkiss,异地专属):
 * 按住屏幕中央的心 → 广播"我在触碰";两人同时按住 → 双端持续震动 + 心跳放大发光 + 爱心雨,
 * 像隔空触到对方。松手即断开。纯 Realtime Broadcast,不落库。
 *
 * 弱网健壮(中美跨太平洋 + iOS/国内网络丢包):按住时每 0.8s 重播一次"我在触碰"心跳,
 * 单个包丢了也没关系,对方总能很快收到;对方超过 2.5s 没有心跳则判为松手。这样两端
 * 都能可靠地进入"已连接",爱心雨在两部手机上都会下(fireEffect 是本机渲染,各端各自触发)。
 *
 * 说明:iOS Safari 目前不支持 navigator.vibrate,震动仅安卓/鸿蒙可感;
 * 视觉反馈(放大 + 光晕 + 涟漪 + 爱心雨)两端都有。
 */
export default function Thumbkiss({ onClose }: { onClose: () => void }) {
  const [myTouch, setMyTouch] = useState(false)
  const [partnerTouch, setPartnerTouch] = useState(false)
  const [partnerPresent, setPartnerPresent] = useState(false)
  const partnerExpiryRef = useRef(0)
  const vibratingRef = useRef(false)

  // 收到对方触碰心跳 → 刷新过期时间;收到松手 → 立刻断开
  useEffect(() => {
    const off = onLive('touch', (p) => {
      if (p.on) {
        partnerExpiryRef.current = Date.now() + 2500
        setPartnerTouch(true)
        setPartnerPresent(true)
      } else {
        partnerExpiryRef.current = 0
        setPartnerTouch(false)
      }
    })
    return () => {
      off()
      // 退出时告诉对方我松手了(冗余两发,降低丢包影响)
      sendLive('touch', { on: false })
      sendLive('touch', { on: false })
    }
  }, [])

  // 心跳过期检测:对方松手且"off"丢了,或对方掉线 → 到点自动判为松手
  useEffect(() => {
    const timer = setInterval(() => {
      if (partnerExpiryRef.current && Date.now() > partnerExpiryRef.current) {
        partnerExpiryRef.current = 0
        setPartnerTouch(false)
      }
    }, 600)
    return () => clearInterval(timer)
  }, [])

  // 我按住:立刻广播 + 每 0.8s 重播心跳(弱网丢包也能让对方最终收到);松手/离开时补发 off
  useEffect(() => {
    if (!myTouch) return
    sendLive('touch', { on: true })
    const timer = setInterval(() => sendLive('touch', { on: true }), 800)
    return () => {
      clearInterval(timer)
      sendLive('touch', { on: false })
      sendLive('touch', { on: false })
    }
  }, [myTouch])

  const connected = myTouch && partnerTouch

  // 连接时:持续撒心形粒子(不是一次性)。两端各自本地触发,所以两部手机都会下爱心雨。
  useEffect(() => {
    if (!connected) return
    fireEffect(['💗', '💞', '💕', '❤️', '✨'], 24)
    const timer = setInterval(() => fireEffect(['💗', '💞', '💕'], 10), 1500)
    return () => clearInterval(timer)
  }, [connected])

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

  const press = () => setMyTouch(true)
  const release = () => setMyTouch(false)

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-rose-50 to-pink-100 px-8">
      {/* 连接时:玫瑰极光脉冲 + 漂浮爱心,让"心连上"的一刻更绚丽 */}
      {connected && (
        <>
          <div className="kiss-aurora pointer-events-none absolute inset-0" />
          <FloatLayer items={['💗', '💞', '❤️', '✨']} count={12} />
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 text-sm text-gray-400"
      >
        {t('关闭')}
      </button>

      <p className="relative z-10 mb-2 text-center text-sm text-gray-500">
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
            ? 'scale-110 bg-rose-300 shadow-[0_0_70px_24px_rgba(244,114,182,0.75)]'
            : myTouch
              ? 'scale-105 bg-rose-200 shadow-[0_0_40px_10px_rgba(251,113,133,0.4)]'
              : 'bg-white shadow-lg'
        }`}
      >
        {/* 连接时:同心涟漪从心口一圈圈荡开 */}
        {connected &&
          [0, 0.6, 1.2].map((d) => (
            <span
              key={d}
              className="kiss-ripple pointer-events-none absolute inset-0 rounded-full border-2 border-rose-300"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        {/* 我已按住、还没连上:向外荡「正在寻找 TA」的涟漪 */}
        {myTouch &&
          !connected &&
          [0, 0.8].map((d) => (
            <span
              key={`s${d}`}
              className="kiss-ripple pointer-events-none absolute inset-0 rounded-full border-2 border-rose-200 opacity-60"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        <span
          className={`relative z-10 text-7xl ${connected || !myTouch ? 'bubble-beat inline-block' : ''}`}
        >
          {connected ? '💗' : '🤍'}
        </span>
      </button>

      <div className="relative z-10 mt-6 flex gap-8 text-center text-xs">
        <span className={myTouch ? 'text-rose-500' : 'text-gray-300'}>
          {t('你')} {myTouch ? '●' : '○'}
        </span>
        <span className={partnerTouch ? 'text-rose-500' : 'text-gray-300'}>
          {t('TA')} {partnerTouch ? '●' : '○'}
        </span>
      </div>
      {!partnerPresent ? (
        <p className="relative z-10 mt-4 text-center text-xs text-gray-300">
          {t('TA 不在线时,可以先按住等 TA 来~')}
        </p>
      ) : !connected ? (
        <p className="relative z-10 mt-4 text-center text-xs text-rose-400">
          {t('TA 也在这儿 💫 一起按住试试')}
        </p>
      ) : null}
    </div>
  )
}
