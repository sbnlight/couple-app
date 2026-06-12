import { useEffect, useState } from 'react'
import { isZh, t } from '../lib/i18n'

/** 描边小屋的每一笔:路径 + 开始时刻 + 时长(pathLength=1 统一节奏) */
const STROKES: { d: string; delay: number; dur: number }[] = [
  { d: 'M30 142 H190', delay: 0, dur: 0.3 }, // 地基
  { d: 'M55 142 V86', delay: 0.28, dur: 0.22 }, // 左墙
  { d: 'M165 142 V86', delay: 0.28, dur: 0.22 }, // 右墙
  { d: 'M45 92 L110 38 L175 92', delay: 0.55, dur: 0.4 }, // 屋顶
  { d: 'M138 56 V30 H156 V70', delay: 0.95, dur: 0.3 }, // 烟囱
  { d: 'M96 142 V104 Q110 94 124 104 V142', delay: 1.2, dur: 0.35 }, // 门
  { d: 'M66 100 h26 v22 h-26 Z', delay: 1.4, dur: 0.3 }, // 窗框
  { d: 'M79 100 V122 M66 111 H92', delay: 1.65, dur: 0.25 }, // 窗棂
]

/** 烟囱升起的心形炊烟 */
const SMOKES = [
  { left: 142, top: 18, delay: 1.95 },
  { left: 150, top: 22, delay: 2.3 },
  { left: 145, top: 20, delay: 2.65 },
]

// 中文逐字浮现;其他语言整体浮现
const TITLE_CHARS = isZh ? ['双', '人', '小', '屋'] : [t('双人小屋')]

/**
 * 开场动画「小屋建造」:一笔一笔画出小屋 → 窗户亮起暖光、
 * 烟囱升起心形炊烟 → 两颗小心从两侧飞进门里 → 名字逐字浮现 + 流光扫过。
 * 约 3.8 秒,点击任意处跳过;系统"减少动态效果"时退化为静态展示。
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
    // 文字约 3.1s 全部出齐,再停留约 1.2s 给人看清,然后淡出
    const t1 = setTimeout(() => setLeaving(true), reduce ? 900 : 4300)
    const t2 = setTimeout(onDone, reduce ? 1300 : 4800)
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
      <div className="relative z-10 flex flex-col items-center">
        {/* 小屋画板(220x170) */}
        <div className="relative h-[170px] w-[220px]">
          {reduce ? (
            <span className="flex h-full items-center justify-center text-6xl">🏠</span>
          ) : (
            <>
              <svg viewBox="0 0 220 170" className="h-full w-full">
                {/* 窗户暖光(描完窗后亮起) */}
                <rect
                  x="67"
                  y="101"
                  width="24"
                  height="20"
                  fill="#FCD34D"
                  fillOpacity="0"
                  style={{ animation: 'intro-window 0.6s ease-out 1.9s both' }}
                />
                {STROKES.map((s, i) => (
                  <path
                    key={i}
                    d={s.d}
                    pathLength={1}
                    fill="none"
                    stroke="var(--c-primary-dark)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="1"
                    strokeDashoffset="1"
                    style={{ animation: `intro-draw ${s.dur}s ease-out ${s.delay}s both` }}
                  />
                ))}
                {/* 门把手 */}
                <circle
                  cx="119"
                  cy="124"
                  r="2.2"
                  fill="var(--c-primary-dark)"
                  fillOpacity="0"
                  style={{ animation: 'intro-window 0.3s ease-out 1.6s both' }}
                />
              </svg>

              {/* 心形炊烟 */}
              {SMOKES.map((s, i) => (
                <span
                  key={i}
                  className="absolute text-sm"
                  style={{
                    left: s.left,
                    top: s.top,
                    animation: `intro-smoke 1.2s ease-out ${s.delay}s both`,
                  }}
                >
                  💗
                </span>
              ))}

              {/* 两颗小心飞进门里(门口约在 x=110,y=120 处) */}
              <span
                className="absolute text-2xl"
                style={{
                  left: 98,
                  top: 104,
                  animation: 'intro-door-left 0.75s ease-in 2.05s both',
                }}
              >
                ❤️
              </span>
              <span
                className="absolute text-2xl"
                style={{
                  left: 98,
                  top: 104,
                  animation: 'intro-door-right 0.75s ease-in 2.25s both',
                }}
              >
                ❤️
              </span>
            </>
          )}
        </div>

        {/* 标题:逐字浮现 + 流光扫过 */}
        <div className="relative mt-4 overflow-hidden px-2">
          <p className="text-2xl font-bold tracking-wide text-primary-dark">
            {reduce
              ? t('双人小屋')
              : TITLE_CHARS.map((ch, i) => (
                  <span
                    key={i}
                    className="inline-block"
                    style={{ animation: `intro-rise 0.5s ease-out ${2.55 + i * 0.1}s both` }}
                  >
                    {ch}
                  </span>
                ))}
          </p>
          {!reduce && (
            <span
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/90 to-transparent"
              style={{ animation: 'intro-shimmer 0.8s ease-in-out 3.05s both' }}
            />
          )}
        </div>
        <p
          className="mt-1.5 text-sm text-gray-400"
          style={reduce ? undefined : { animation: 'intro-rise 0.6s ease-out 2.95s both' }}
        >
          {t('只属于我们两个人的地方')}
        </p>
        {updated && (
          <p
            className="mt-3 text-xs font-medium text-green-600"
            style={reduce ? undefined : { animation: 'intro-rise 0.5s ease-out 3.15s both' }}
          >
            {t('✓ 已更新到最新版本')}
          </p>
        )}
      </div>
    </div>
  )
}
