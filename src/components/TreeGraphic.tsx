import type { CSSProperties } from 'react'

/**
 * 爱情树的「真树」内联 SVG(替代原来的单个 emoji)。
 * 由成长阶段 stageIdx(0–6)驱动:越大越高、树冠越满,满级开花、封顶挂彩虹;
 * 季节 season 换叶色 + 冬天积雪。animate=true 时(进入园地)枝干描边生长、叶簇/花逐个弹出。
 * 纯 SVG、无外部资源、CSP 安全、可离线。
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

// 树冠圆:[cx, cy, r, 从第几阶段开始出现]
const CANOPY: [number, number, number, number][] = [
  [100, 96, 34, 0],
  [78, 106, 25, 1],
  [122, 106, 25, 2],
  [85, 83, 23, 3],
  [116, 83, 23, 4],
  [100, 118, 27, 3],
  [100, 74, 20, 5],
]
// 枝干:[路径, 从第几阶段出现, 线宽(0 表示主干,用随阶段变粗的宽度)]
const BRANCH: [string, number, number][] = [
  ['M100,214 C97,184 103,160 100,120', 0, 0],
  ['M100,170 C88,162 80,152 70,142', 2, 3.2],
  ['M100,150 C112,144 120,135 130,127', 2, 3.2],
  ['M100,140 C90,134 84,128 76,119', 3, 2.6],
  ['M100,128 C108,123 114,118 122,110', 4, 2.6],
]
const FLOWERS: [number, number][] = [
  [86, 88], [112, 86], [100, 100], [74, 108], [126, 106], [96, 78], [118, 100],
  [82, 120], [118, 120], [100, 124], [70, 98], [130, 98], [100, 64], [92, 110],
]
// 回忆果实的挂点(树冠上,与树同坐标系,故会随树摇曳/缩放)
const FRUIT_ANCHORS: [number, number][] = [
  [90, 88], [114, 90], [78, 102], [124, 104], [100, 74], [98, 112], [118, 118], [74, 116],
]
const SEASONS: Record<Season, { leaf: string; dark: string; blossom: boolean; snow: boolean }> = {
  spring: { leaf: '#86efac', dark: '#4ade80', blossom: true, snow: false },
  summer: { leaf: '#34d399', dark: '#10b981', blossom: false, snow: false },
  autumn: { leaf: '#f59e0b', dark: '#d97706', blossom: false, snow: false },
  winter: { leaf: '#a7c4bc', dark: '#8aa8a0', blossom: false, snow: true },
}
const SCALE = [0.44, 0.56, 0.68, 0.82, 0.94, 1, 1]

/** 由月份(0–11)判断季节(南北半球都按北半球,两人都在北半球) */
export function seasonOfMonth(m: number): Season {
  if (m >= 2 && m <= 4) return 'spring'
  if (m >= 5 && m <= 7) return 'summer'
  if (m >= 8 && m <= 10) return 'autumn'
  return 'winter'
}

export default function TreeGraphic({
  stageIdx,
  season,
  animate = false,
  width = 190,
  fruits,
  onFruitClick,
}: {
  stageIdx: number
  season: Season
  animate?: boolean
  width?: number
  /** 回忆果实(emoji 列表);点一颗回调其序号 */
  fruits?: string[]
  onFruitClick?: (i: number) => void
}) {
  const s = SCALE[stageIdx] ?? 1
  const se = SEASONS[season]
  const trunkW = 3 + stageIdx * 1.8
  const branches = BRANCH.filter((b) => stageIdx >= b[1])
  const canopy = CANOPY.filter((c) => stageIdx >= c[3])
  const showFlowers = stageIdx >= 5 || se.blossom
  const flowers = showFlowers ? FLOWERS.slice(0, stageIdx >= 5 ? FLOWERS.length : 5) : []

  // 递增动画延迟:枝干先长 → 叶簇再冒 → 花最后开
  let d = 0
  const delay = (): CSSProperties | undefined =>
    animate ? { animationDelay: `${(d += 0.06).toFixed(2)}s` } : undefined
  const branchCls = animate ? 'tree-branch' : undefined
  const popCls = animate ? 'tree-pop' : undefined

  return (
    <svg viewBox="0 0 200 240" width={width} height={width * 1.2} className="block">
      <ellipse cx="100" cy="216" rx={44 * s} ry="6" fill="rgba(0,0,0,.12)" />
      <g transform={`translate(100 214) scale(${s}) translate(-100 -214)`}>
        {/* 彩虹(封顶阶段) */}
        {stageIdx >= 6 && (
          <g opacity="0.5" fill="none" strokeWidth="6">
            {['#f87171', '#fb923c', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa'].map((c, i) => (
              <path key={c} d="M40,150 A70,70 0 0 1 160,150" stroke={c} transform={`translate(0 ${i * 6}) scale(${1 - i * 0.02})`} style={{ transformOrigin: '100px 150px' }} />
            ))}
          </g>
        )}
        {/* 枝干(描边生长) */}
        {branches.map((b, i) => (
          <path
            key={i}
            d={b[0]}
            fill="none"
            stroke="#8b5a2b"
            strokeWidth={b[2] === 0 ? trunkW : b[2]}
            strokeLinecap="round"
            pathLength={1}
            className={branchCls}
            style={delay()}
          />
        ))}
        {/* 树冠:每簇 = 主色 + 暗色内影(+ 冬天雪盖),整簇一起弹出 */}
        {canopy.map((c, i) => (
          <g key={`c${i}`} className={popCls} style={delay()}>
            <circle cx={c[0]} cy={c[1]} r={c[2]} fill={se.leaf} />
            <circle cx={c[0] - c[2] * 0.28} cy={c[1] + c[2] * 0.28} r={c[2] * 0.55} fill={se.dark} opacity="0.35" />
            {se.snow && (
              <ellipse cx={c[0]} cy={c[1] - c[2] * 0.6} rx={c[2] * 0.7} ry={c[2] * 0.3} fill="#fff" opacity="0.85" />
            )}
          </g>
        ))}
        {/* 花 */}
        {flowers.map((f, i) => (
          <g key={`f${i}`} className={popCls} style={delay()}>
            <circle cx={f[0]} cy={f[1]} r="3.4" fill={i % 2 ? '#f9a8d4' : '#fff'} />
            <circle cx={f[0]} cy={f[1]} r="1.3" fill="#fbbf24" />
          </g>
        ))}
        {/* 回忆果实:点一颗弹出那段回忆 */}
        {fruits?.slice(0, FRUIT_ANCHORS.length).map((emoji, i) => {
          const [ax, ay] = FRUIT_ANCHORS[i]
          return (
            <g
              key={`fruit${i}`}
              className={popCls}
              style={{ ...delay(), cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation()
                onFruitClick?.(i)
              }}
            >
              <circle cx={ax} cy={ay} r="8.5" fill="rgba(255,255,255,.45)" />
              <text x={ax} y={ay} textAnchor="middle" dominantBaseline="central" fontSize="13">
                {emoji}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
