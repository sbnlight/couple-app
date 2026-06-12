import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

/** 迸出的小心心:飞散方向与延迟 */
const BURSTS = [
  { x: '-72px', y: '-58px', delay: 0.95, emoji: '💕' },
  { x: '74px', y: '-64px', delay: 1.0, emoji: '✨' },
  { x: '-88px', y: '4px', delay: 1.05, emoji: '✨' },
  { x: '88px', y: '-4px', delay: 0.98, emoji: '💕' },
  { x: '-42px', y: '-92px', delay: 1.1, emoji: '💗' },
  { x: '46px', y: '-90px', delay: 1.02, emoji: '✨' },
]

/**
 * 开场动画「双心相遇」:两颗小心从两侧飞入 → 碰撞合为一颗大心弹跳
 * → 迸出小心心 → 名字浮现 → 整体淡出。约 2.9 秒,点击任意处跳过。
 * 系统开启"减少动态效果"时只做短暂淡入淡出。
 */
export default function SplashIntro({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), reduce ? 700 : 2400)
    const t2 = setTimeout(onDone, reduce ? 1100 : 2900)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onDone, reduce])

  const skip = () => {
    setLeaving(true)
    setTimeout(onDone, 300)
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-warmbg transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={skip}
      role="presentation"
    >
      <div className="flex flex-col items-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          {reduce ? (
            <span className="text-6xl">❤️</span>
          ) : (
            <>
              {/* 两颗飞入的小心 */}
              <span
                className="absolute text-4xl"
                style={{
                  animation:
                    'intro-fly-left 0.85s ease-in both, intro-vanish 0.05s linear 0.82s forwards',
                }}
              >
                ❤️
              </span>
              <span
                className="absolute text-4xl"
                style={{
                  animation:
                    'intro-fly-right 0.85s ease-in both, intro-vanish 0.05s linear 0.82s forwards',
                }}
              >
                ❤️
              </span>
              {/* 合体大心 */}
              <span
                className="absolute text-7xl"
                style={{
                  animation: 'intro-pop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) 0.82s both',
                }}
              >
                ❤️
              </span>
              {/* 迸出的小心心 */}
              {BURSTS.map((b, i) => (
                <span
                  key={i}
                  className="absolute text-lg"
                  style={{
                    ...({ '--bx': b.x, '--by': b.y } as CSSProperties),
                    animation: `intro-burst 0.9s ease-out ${b.delay}s both`,
                  }}
                >
                  {b.emoji}
                </span>
              ))}
            </>
          )}
        </div>

        <p
          className="mt-5 text-2xl font-bold text-primary-dark"
          style={reduce ? undefined : { animation: 'intro-rise 0.6s ease-out 1.4s both' }}
        >
          双人小屋
        </p>
        <p
          className="mt-1.5 text-sm text-gray-400"
          style={reduce ? undefined : { animation: 'intro-rise 0.6s ease-out 1.7s both' }}
        >
          只属于我们两个人的地方
        </p>
      </div>
    </div>
  )
}
