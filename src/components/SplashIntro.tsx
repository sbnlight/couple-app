import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

/** 碰撞后飞散的碎心与金粉:方向 / 旋转 / 延迟 / 形态 */
const BURSTS: {
  x: string
  y: string
  rot: string
  delay: number
  kind: 'emoji' | 'dot'
  emoji?: string
  size?: number
  color?: string
}[] = [
  { x: '-78px', y: '-62px', rot: '-120deg', delay: 0.95, kind: 'emoji', emoji: '💕' },
  { x: '80px', y: '-70px', rot: '140deg', delay: 1.0, kind: 'emoji', emoji: '✨' },
  { x: '-96px', y: '2px', rot: '-200deg', delay: 1.05, kind: 'emoji', emoji: '✨' },
  { x: '96px', y: '-6px', rot: '180deg', delay: 0.98, kind: 'emoji', emoji: '💕' },
  { x: '-46px', y: '-100px', rot: '-90deg', delay: 1.1, kind: 'emoji', emoji: '💗' },
  { x: '50px', y: '-98px', rot: '100deg', delay: 1.02, kind: 'emoji', emoji: '💖' },
  { x: '-60px', y: '52px', rot: '-160deg', delay: 1.08, kind: 'emoji', emoji: '✨' },
  { x: '62px', y: '48px', rot: '160deg', delay: 1.12, kind: 'emoji', emoji: '💕' },
  // 金粉小颗粒
  { x: '-110px', y: '-30px', rot: '0deg', delay: 0.96, kind: 'dot', size: 7, color: '#FBBF24' },
  { x: '112px', y: '-36px', rot: '0deg', delay: 1.0, kind: 'dot', size: 6, color: '#F59E0B' },
  { x: '-30px', y: '-116px', rot: '0deg', delay: 1.06, kind: 'dot', size: 6, color: '#FBBF24' },
  { x: '34px', y: '-112px', rot: '0deg', delay: 0.99, kind: 'dot', size: 8, color: '#FCD34D' },
  { x: '-88px', y: '-88px', rot: '0deg', delay: 1.12, kind: 'dot', size: 5, color: '#F9A8D4' },
  { x: '92px', y: '-84px', rot: '0deg', delay: 1.04, kind: 'dot', size: 7, color: '#F9A8D4' },
]

/** 全屏漂浮光点(bokeh):位置 / 大小 / 透明度 / 漂浮节奏(负延迟=开场时已在途中) */
const BOKEH: { left: string; top: string; size: number; opacity: number; dur: number; delay: number }[] = [
  { left: '8%', top: '72%', size: 18, opacity: 0.5, dur: 3.6, delay: -1.2 },
  { left: '18%', top: '38%', size: 10, opacity: 0.4, dur: 4.2, delay: -2.6 },
  { left: '27%', top: '85%', size: 24, opacity: 0.35, dur: 3.2, delay: -0.4 },
  { left: '38%', top: '24%', size: 8, opacity: 0.45, dur: 4.6, delay: -3.0 },
  { left: '52%', top: '78%', size: 14, opacity: 0.5, dur: 3.4, delay: -1.8 },
  { left: '63%', top: '30%', size: 12, opacity: 0.4, dur: 4.0, delay: -2.2 },
  { left: '72%', top: '64%', size: 20, opacity: 0.35, dur: 3.8, delay: -0.8 },
  { left: '83%', top: '42%', size: 9, opacity: 0.45, dur: 4.4, delay: -2.9 },
  { left: '90%', top: '80%', size: 16, opacity: 0.4, dur: 3.3, delay: -1.5 },
  { left: '45%', top: '12%', size: 11, opacity: 0.35, dur: 4.1, delay: -3.4 },
]

const TITLE_CHARS = ['双', '人', '小', '屋']

/**
 * 开场动画「双心相遇 · 金粉漫天版」:
 * 柔光与漂浮光点铺底 → 两颗小心飞入相撞(轻闪 + 冲击波光环)
 * → 合体大心弹跳,金粉碎心四散 → 标题逐字浮现,流光扫过 → 整体淡出。
 * 约 3.2 秒,点击任意处跳过;系统"减少动态效果"时退化为简单淡入。
 */
export default function SplashIntro({
  onDone,
  updated = false,
}: {
  onDone: () => void
  /** 刚完成版本更新后的首次启动:动画里加一行"已更新"提示 */
  updated?: boolean
}) {
  const [leaving, setLeaving] = useState(false)
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), reduce ? 700 : 2700)
    const t2 = setTimeout(onDone, reduce ? 1100 : 3200)
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
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-warmbg transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={skip}
      role="presentation"
    >
      {!reduce && (
        <>
          {/* 漂浮光点铺满全屏 */}
          {BOKEH.map((b, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-primary"
              style={{
                ...({ '--bo': String(b.opacity) } as CSSProperties),
                left: b.left,
                top: b.top,
                width: b.size,
                height: b.size,
                filter: 'blur(5px)',
                animation: `intro-float ${b.dur}s linear ${b.delay}s infinite`,
              }}
            />
          ))}
          {/* 碰撞瞬间的轻闪 */}
          <div
            className="pointer-events-none absolute inset-0 bg-white"
            style={{ animation: 'intro-flash 0.5s ease-out 0.83s both' }}
          />
        </>
      )}

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative flex h-32 w-32 items-center justify-center">
          {reduce ? (
            <span className="text-6xl">❤️</span>
          ) : (
            <>
              {/* 大心背后的柔光晕 */}
              <span
                className="absolute h-44 w-44 rounded-full"
                style={{
                  background:
                    'radial-gradient(circle, var(--c-primary-light) 0%, transparent 70%)',
                  animation: 'intro-glow 0.9s ease-out 0.8s both',
                }}
              />
              {/* 碰撞冲击波:两道光环先后扩散 */}
              <span
                className="absolute h-24 w-24 rounded-full border-2 border-primary"
                style={{ animation: 'intro-ring 0.8s ease-out 0.85s both' }}
              />
              <span
                className="absolute h-24 w-24 rounded-full border border-primary"
                style={{ animation: 'intro-ring 0.9s ease-out 1.02s both' }}
              />
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
              {/* 金粉与碎心四散 */}
              {BURSTS.map((b, i) =>
                b.kind === 'emoji' ? (
                  <span
                    key={i}
                    className="absolute text-lg"
                    style={{
                      ...({ '--bx': b.x, '--by': b.y, '--rot': b.rot } as CSSProperties),
                      animation: `intro-burst 1s ease-out ${b.delay}s both`,
                    }}
                  >
                    {b.emoji}
                  </span>
                ) : (
                  <span
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      ...({ '--bx': b.x, '--by': b.y, '--rot': b.rot } as CSSProperties),
                      width: b.size,
                      height: b.size,
                      backgroundColor: b.color,
                      animation: `intro-burst 1.05s ease-out ${b.delay}s both`,
                    }}
                  />
                ),
              )}
            </>
          )}
        </div>

        {/* 标题:逐字浮现 + 流光扫过 */}
        <div className="relative mt-5 overflow-hidden px-2">
          <p className="text-2xl font-bold tracking-wide text-primary-dark">
            {reduce
              ? '双人小屋'
              : TITLE_CHARS.map((ch, i) => (
                  <span
                    key={i}
                    className="inline-block"
                    style={{ animation: `intro-rise 0.5s ease-out ${1.35 + i * 0.12}s both` }}
                  >
                    {ch}
                  </span>
                ))}
          </p>
          {!reduce && (
            <span
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/90 to-transparent"
              style={{ animation: 'intro-shimmer 0.8s ease-in-out 2.05s both' }}
            />
          )}
        </div>
        <p
          className="mt-1.5 text-sm text-gray-400"
          style={reduce ? undefined : { animation: 'intro-rise 0.6s ease-out 1.95s both' }}
        >
          只属于我们两个人的地方
        </p>
        {updated && (
          <p
            className="mt-3 text-xs font-medium text-green-600"
            style={reduce ? undefined : { animation: 'intro-rise 0.5s ease-out 2.2s both' }}
          >
            ✓ 已更新到最新版本
          </p>
        )}
      </div>
    </div>
  )
}
