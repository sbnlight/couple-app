import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fireEffect } from '../lib/effects'
import Portal from './Portal'
import { CountUp } from './Fx'
import TreeGraphic, { seasonOfMonth } from './TreeGraphic'
import type { Season } from './TreeGraphic'
import { timeInZone } from '../lib/time'
import { weatherForTz } from '../lib/weather'
import { t } from '../lib/i18n'

/**
 * 爱情树(共同养成):不新增表,由你们已有的互动"浇灌"成长——
 * 成长值 = 在一起天数 ×1 + 打卡次数 ×2 + 想你次数 ×1。
 * 「我们」页放一张概览卡,点开进入全屏「爱情树园地」:
 * 内联 SVG 真树随成长阶段长大、季节换叶、天空随时辰变化、点树说树语、浇水特效、成就阶梯。
 */

const STAGES = [
  { emoji: '🌱', name: '破土的种子', min: 0 },
  { emoji: '🌿', name: '抽芽的小苗', min: 30 },
  { emoji: '🪴', name: '茁壮的盆栽', min: 100 },
  { emoji: '🌳', name: '成荫的大树', min: 250 },
  { emoji: '🌲', name: '参天的常青树', min: 500 },
  { emoji: '🌸', name: '满树的花', min: 900 },
  { emoji: '🌈', name: '花开彩虹', min: 1500 },
]

const STAGE_KEY = 'love-tree-stage'

/** 季节飘落物:春樱花、秋落叶、冬雪;夏天不飘(留云) */
const PARTICLE: Record<Season, string> = { spring: '🌸', summer: '', autumn: '🍂', winter: '❄️' }

/** 树语:点树/浇水时随机蹦一句 */
const TREE_TALK = [
  '你们今天也要好好的呀 🌿',
  '我在偷偷记录你们的每一天',
  '想 TA 的时候,我的叶子会沙沙响',
  '再浇一点点,我就又长高啦',
  '你们的打卡是我最爱的肥料 📍',
  '风把 TA 的想念吹过来了~',
  '等我开花的那天,要一起来看哦',
  '今天也被你们喂得饱饱的 💗',
  '我的年轮里全是你们的故事',
  '嘘…我听到 TA 在想你',
  '异地不可怕,我帮你们把爱存起来',
  '每一片新叶,都是一次心动',
]

/** 按当地时间给天空换色:清晨/白天/黄昏/夜晚 */
function skyByHour(h: number): { bg: string; night: boolean; label: string } {
  if (h >= 5 && h < 8)
    return { bg: 'linear-gradient(180deg, #fde68a, #fbcfe8 55%, #e0f2fe)', night: false, label: '清晨' }
  if (h >= 8 && h < 17)
    return { bg: 'linear-gradient(180deg, #7dd3fc, #bae6fd 55%, #ecfccb)', night: false, label: '白天' }
  if (h >= 17 && h < 20)
    return { bg: 'linear-gradient(180deg, #fdba74, #f9a8d4 55%, #c4b5fd)', night: false, label: '黄昏' }
  return { bg: 'linear-gradient(180deg, #1e1b4b, #312e81 60%, #4c1d95)', night: true, label: '夜晚' }
}

/** 回忆果实:挂在树上的一段共同回忆(实现的愿望 / 纪念日) */
type Memory = { emoji: string; kind: string; text: string; date: string | null }

export default function LoveTree({
  coupleId,
  daysTogether,
  userId = null,
  partnerTz = null,
  partnerName = null,
}: {
  coupleId: string
  /** 在一起天数(没设在一起日期则传小屋建立天数) */
  daysTogether: number
  /** 本人 id(双人双色贡献拆分用) */
  userId?: string | null
  /** 对方时区/昵称(双子天空「TA 那边此刻」用) */
  partnerTz?: string | null
  partnerName?: string | null
}) {
  const [checkins, setCheckins] = useState(0)
  const [misses, setMisses] = useState(0)
  const [loading, setLoading] = useState(true)
  // 是否已成功拿到真实计数:未成功则不据此判定"升级"(避免弱网清零→再成功时误庆祝)
  const [loadOk, setLoadOk] = useState(false)
  const [open, setOpen] = useState(false)
  const [talk, setTalk] = useState('')
  const [bouncing, setBouncing] = useState(false)
  const [watering, setWatering] = useState(false)
  const [waterKey, setWaterKey] = useState(0)
  const [levelUp, setLevelUp] = useState<{ to: string } | null>(null)
  const [drawKey, setDrawKey] = useState(0)
  const [memories, setMemories] = useState<Memory[]>([])
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null)
  const [mineContrib, setMineContrib] = useState<number | null>(null)
  const talkTimer = useRef<number | undefined>(undefined)
  const enteredRef = useRef(false)

  const season = seasonOfMonth(new Date().getMonth())
  // 一次生成的飘落物 / 萤火虫布局(不随每次渲染乱跳)
  const [particles] = useState(() =>
    Array.from({ length: 9 }, () => ({
      left: 4 + Math.random() * 92,
      delay: Math.random() * 7,
      dur: 6 + Math.random() * 5,
      size: 11 + Math.random() * 9,
    })),
  )
  const [fireflies] = useState(() =>
    Array.from({ length: 7 }, () => ({
      left: 12 + Math.random() * 76,
      top: 18 + Math.random() * 56,
      size: 4 + Math.random() * 4,
      delay: Math.random() * 4,
      dur: 3.5 + Math.random() * 3,
    })),
  )

  // 双子天空:进园地时拉一次「对方那边」的天气,配合 timeInZone 显示 TA 此刻时辰
  const [partnerW, setPartnerW] = useState<{ emoji: string; temp: number } | null>(null)
  useEffect(() => {
    if (!open || !partnerTz) return
    let cancelled = false
    void weatherForTz(partnerTz).then((w) => {
      if (!cancelled) setPartnerW(w)
    })
    return () => {
      cancelled = true
    }
  }, [open, partnerTz])
  const partnerTime = partnerTz ? timeInZone(partnerTz) : null

  // 稀有变体:按「日期 + coupleId」种子低概率掷出金树/极光树(两人当天看到同一棵,离线可算)
  const variantClass = (() => {
    const key = new Date().toISOString().slice(0, 10) + coupleId
    let h = 0
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
    if (h % 19 === 0) return 'tree-var-gold'
    if (h % 19 === 1) return 'tree-var-aurora'
    return ''
  })()

  // 回忆果实:进园地时拉「实现的愿望 + 纪念日」,挂到树上(表缺失/RLS 拦下就空,不报错)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const [w, a] = await Promise.all([
        supabase
          .from('wishes')
          .select('content, done_at')
          .eq('couple_id', coupleId)
          .eq('done', true)
          .order('done_at', { ascending: false })
          .limit(5),
        supabase
          .from('anniversaries')
          .select('title, anniv_date')
          .eq('couple_id', coupleId)
          .order('anniv_date', { ascending: false })
          .limit(5),
      ])
      if (cancelled) return
      const mem: Memory[] = []
      for (const x of (w.data as { content: string; done_at: string | null }[] | null) ?? [])
        mem.push({ emoji: '🍎', kind: t('实现的愿望'), text: x.content, date: x.done_at?.slice(0, 10) ?? null })
      for (const x of (a.data as { title: string; anniv_date: string }[] | null) ?? [])
        mem.push({ emoji: '🎀', kind: t('纪念日'), text: x.title, date: x.anniv_date })
      setMemories(mem.slice(0, 8))
    })()
    return () => {
      cancelled = true
    }
  }, [open, coupleId])

  // 双人双色:各自「浇灌」贡献(打卡×2 + 想你×1),拆蓝(你)/粉(TA)
  useEffect(() => {
    if (!open || !userId) return
    let cancelled = false
    void (async () => {
      const [c, m] = await Promise.all([
        supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('user_id', userId),
        supabase.from('misses').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId).eq('user_id', userId),
      ])
      if (!cancelled && !c.error && !m.error) setMineContrib((c.count ?? 0) * 2 + (m.count ?? 0))
    })()
    return () => {
      cancelled = true
    }
  }, [open, userId, coupleId])

  const loadCounts = async () => {
    const [c, m] = await Promise.all([
      supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId),
      supabase.from('misses').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId),
    ])
    // 弱网查询失败:保留上次计数(不清零成 0,免得树忽然缩小);也不标记为可靠数据
    if (c.error || m.error) {
      console.warn('[LoveTree loadCounts]', c.error ?? m.error)
      setLoading(false)
      return
    }
    setCheckins(c.count ?? 0)
    setMisses(m.count ?? 0)
    setLoadOk(true)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!cancelled) await loadCounts()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId])

  const points = daysTogether + checkins * 2 + misses
  let stageIdx = 0
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (points >= STAGES[i].min) {
      stageIdx = i
      break
    }
  }
  const stage = STAGES[stageIdx]
  const next = STAGES[stageIdx + 1]
  const progress = next
    ? Math.min(100, Math.round(((points - stage.min) / (next.min - stage.min)) * 100))
    : 100
  const treeStage = loading ? 0 : stageIdx

  // 恋爱里程碑徽章:全部只读现有计数派生,不新增表
  const badges = [
    { icon: '💞', label: '在一起 100 天', ok: daysTogether >= 100 },
    { icon: '💝', label: '在一起 365 天', ok: daysTogether >= 365 },
    { icon: '💗', label: '在一起 520 天', ok: daysTogether >= 520 },
    { icon: '👑', label: '在一起 1314 天', ok: daysTogether >= 1314 },
    { icon: '📍', label: '打卡满 10 次', ok: checkins >= 10 },
    { icon: '🗺️', label: '打卡满 50 次', ok: checkins >= 50 },
    { icon: '💭', label: '想你满 50 次', ok: misses >= 50 },
    { icon: '🌌', label: '想你满 200 次', ok: misses >= 200 },
    { icon: '🌳', label: '养成大树', ok: stageIdx >= 3 },
    { icon: '🌸', label: '养成满树花', ok: stageIdx >= 5 },
    { icon: '🌈', label: '养成彩虹树', ok: stageIdx >= 6 },
  ]

  // 升级撒花:本机记录上次阶段,长大到新阶段时庆祝一次(必须是可靠数据,否则弱网清零会误判)
  useEffect(() => {
    if (loading || !loadOk) return
    const prev = Number(localStorage.getItem(STAGE_KEY) ?? '-1')
    if (stageIdx > prev) {
      if (prev >= 0) {
        fireEffect(['🎉', '🌸', '✨', '🌿'], 40)
        setLevelUp({ to: stage.name })
        setDrawKey((k) => k + 1) // 让树重新"长一遍"
        window.setTimeout(() => setLevelUp(null), 2800)
      }
      localStorage.setItem(STAGE_KEY, String(stageIdx))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, stageIdx])

  // 进入园地:飘一场落叶欢迎(每次打开一次)+ 离开-回来揭示(隔 ≥1 天温柔提示)
  useEffect(() => {
    if (open && !enteredRef.current) {
      enteredRef.current = true
      setTimeout(() => fireEffect(['🍃', '🌿', '✨'], 16), 350)
      const KEY = 'love-tree-last-open'
      const last = Number(localStorage.getItem(KEY) ?? '0')
      const days = last > 0 ? Math.floor((Date.now() - last) / 86_400_000) : 0
      if (days >= 1) {
        setTimeout(() => {
          setTalk(t('你不在的这 {n} 天,小树一直乖乖等你们回来 🌿', { n: days }))
          window.clearTimeout(talkTimer.current)
          talkTimer.current = window.setTimeout(() => setTalk(''), 4200)
        }, 1100)
      }
      localStorage.setItem(KEY, String(Date.now()))
    }
    if (!open) enteredRef.current = false
  }, [open])

  const say = (text: string) => {
    setTalk(text)
    window.clearTimeout(talkTimer.current)
    talkTimer.current = window.setTimeout(() => setTalk(''), 3600)
  }

  const pokeTree = () => {
    setBouncing(true)
    setTimeout(() => setBouncing(false), 650)
    navigator.vibrate?.(30)
    say(TREE_TALK[Math.floor(Math.random() * TREE_TALK.length)])
  }

  const water = () => {
    navigator.vibrate?.([20, 60, 20])
    setBouncing(true)
    setTimeout(() => setBouncing(false), 650)
    setWaterKey((k) => k + 1) // 重挂水珠/涟漪节点,重放动画
    setWatering(true)
    setTimeout(() => setWatering(false), 1000)
    say(t('咕嘟咕嘟…谢谢浇水!多打卡、多想 TA,我长得更快哦 🌱'))
    void loadCounts() // 顺便刷新(对方可能刚打卡/想你)
  }

  const sky = skyByHour(new Date().getHours())
  const particleChar = PARTICLE[season]

  return (
    <>
      {/* 概览卡(我们页) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-2xl bg-gradient-to-b from-emerald-50 to-white p-5 text-left"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-500">{t('🌳 我们的爱情树')}</p>
          <span className="text-xs text-gray-300">{t('进入园地 ›')}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className={`shrink-0 ${variantClass}`}>
            <TreeGraphic stageIdx={treeStage} season={season} width={52} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-emerald-700">{t(stage.name)}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
              <div
                className="tree-progress h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {next
                ? t('浇灌值 {p} · 再攒 {n} 点长成「{s}」', { p: points, n: next.min - points, s: t(next.name) })
                : t('浇灌值 {p} · 已经长到最茂盛啦 🎉', { p: points })}
            </p>
          </div>
        </div>
      </button>

      {/* 爱情树园地(全屏子页)。Portal 到 body,避免被 .page-in 入场动画的 transform 困住而跑到顶部 */}
      {open && (
        <Portal>
          <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col overflow-hidden bg-warmbg">
            {/* 天空场景 */}
            <div
              className="relative shrink-0 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]"
              style={{ background: sky.bg }}
            >
              {/* 季节飘落物(春樱/秋叶/冬雪) */}
              {particleChar && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {particles.map((p, i) => (
                    <span
                      key={i}
                      className="tree-fall"
                      style={{
                        left: `${p.left}%`,
                        fontSize: p.size,
                        animationDelay: `${p.delay}s`,
                        animationDuration: `${p.dur}s`,
                      }}
                    >
                      {particleChar}
                    </span>
                  ))}
                </div>
              )}
              {/* 夜晚萤火虫 */}
              {sky.night && (
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {fireflies.map((f, i) => (
                    <span
                      key={i}
                      className="firefly"
                      style={{
                        left: `${f.left}%`,
                        top: `${f.top}%`,
                        width: f.size,
                        height: f.size,
                        animationDelay: `${f.delay}s`,
                        animationDuration: `${f.dur}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="relative flex items-center px-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`px-1 text-2xl ${sky.night ? 'text-white/80' : 'text-gray-600/70'}`}
                >
                  ‹
                </button>
                <h1
                  className={`flex-1 text-center text-base font-semibold ${
                    sky.night ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {t('爱情树园地')}
                </h1>
                <span className={`w-7 text-xs ${sky.night ? 'text-white/70' : 'text-gray-500/80'}`}>
                  {sky.night ? '🌙' : '☀️'}
                </span>
              </div>

              {/* 双子天空:TA 那边此刻(时辰 + 天气),延续异地共情 */}
              {partnerTz && partnerTime && (
                <div
                  className={`relative mx-auto mt-1.5 w-fit rounded-full px-3 py-1 text-[11px] ${
                    sky.night ? 'bg-white/15 text-white/90' : 'bg-white/50 text-gray-600'
                  }`}
                >
                  {t('{name} 那边此刻', { name: partnerName ?? t('TA') })} · {partnerTime.hm}{' '}
                  {partnerTime.night ? '🌙' : '☀️'}
                  {partnerW && ` · ${partnerW.emoji} ${partnerW.temp}°`}
                </div>
              )}

              {/* 白天点缀云(夜晚由萤火虫接管) */}
              {!sky.night && (
                <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-around text-sm opacity-80">
                  <span className="deco-float inline-block">☁️</span>
                  <span className="deco-float inline-block" style={{ animationDelay: '1s' }}>🕊️</span>
                  <span className="deco-float inline-block" style={{ animationDelay: '2s' }}>☁️</span>
                </div>
              )}

              {/* 树语气泡 */}
              <div className="relative flex h-10 items-end justify-center px-8">
                {talk && (
                  <span className="modal-pop max-w-full rounded-2xl rounded-bl-sm bg-white/90 px-3 py-1.5 text-xs text-emerald-800 shadow">
                    {talk}
                  </span>
                )}
              </div>

              {/* 树本体:点一点会说话;浇水时头顶落水珠、根部荡涟漪 */}
              <div className="relative mx-auto" style={{ width: 176 }}>
                <button
                  type="button"
                  onClick={pokeTree}
                  className="block w-full select-none text-center"
                  aria-label="戳戳爱情树"
                >
                  <span className={variantClass}>
                    <span className={`inline-block drop-shadow-lg ${bouncing ? 'tree-bounce' : 'tree-sway'}`}>
                      <TreeGraphic
                        key={drawKey}
                        stageIdx={treeStage}
                        season={season}
                        animate
                        width={176}
                        fruits={treeStage >= 2 ? memories.map((m) => m.emoji) : undefined}
                        onFruitClick={(i) => setActiveMemory(memories[i])}
                      />
                    </span>
                  </span>
                </button>
                {watering && (
                  <div key={waterKey} className="pointer-events-none absolute inset-x-0 top-3 z-10">
                    {[24, 40, 50, 60, 76, 44, 66].map((l, i) => (
                      <span
                        key={i}
                        className="water-drop"
                        style={{ left: `${l}%`, animationDelay: `${i * 0.07}s` }}
                      />
                    ))}
                    <span
                      className="water-ripple"
                      style={{ left: '50%', bottom: 10, width: 64, height: 18, marginLeft: -32 }}
                    />
                  </div>
                )}
              </div>

              <p
                className={`mt-2 text-center text-sm font-semibold ${
                  sky.night ? 'text-white' : 'text-emerald-800'
                }`}
              >
                {t(stage.name)}
                <span className={`ml-2 text-xs font-normal ${sky.night ? 'text-white/70' : 'text-emerald-700/70'}`}>
                  {t('浇灌值')} <CountUp value={points} run={open} />
                </span>
              </p>
              {next && (
                <div className="mx-auto mt-2 w-2/3">
                  <div className="h-2 overflow-hidden rounded-full bg-white/40">
                    <div
                      className="tree-progress h-full rounded-full bg-emerald-400 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p
                    className={`mt-1 text-center text-xs ${
                      sky.night ? 'text-white/70' : 'text-emerald-800/70'
                    }`}
                  >
                    {t('再攒 {n} 点长成「{s}」{e}', { n: next.min - points, s: t(next.name), e: next.emoji })}
                  </p>
                </div>
              )}
            </div>

            {/* 下半部:养分 + 成就 */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {/* 浇水 */}
              <button
                type="button"
                onClick={water}
                className="w-full rounded-full bg-emerald-400 py-3 text-base font-medium text-white shadow-lg shadow-emerald-200 active:scale-95"
              >
                {t('💧 给小树浇浇水')}
              </button>

              {/* 养分来源 */}
              <p className="mb-2 mt-5 px-1 text-sm font-medium text-gray-500">{t('🌿 它靠什么长大')}</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white p-3 text-center">
                  <p className="text-xl">❤️</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700">
                    <CountUp value={daysTogether} run={open} />
                  </p>
                  <p className="text-xs text-gray-400">{t('在一起天数 ×1')}</p>
                </div>
                <div className="rounded-2xl bg-white p-3 text-center">
                  <p className="text-xl">📍</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700">
                    <CountUp value={checkins} run={open} />
                  </p>
                  <p className="text-xs text-gray-400">{t('打卡次数 ×2')}</p>
                </div>
                <div className="rounded-2xl bg-white p-3 text-center">
                  <p className="text-xl">💭</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700">
                    <CountUp value={misses} run={open} />
                  </p>
                  <p className="text-xs text-gray-400">{t('想你次数 ×1')}</p>
                </div>
              </div>

              {/* 双人双色:这棵树一半是你一半是 TA */}
              {mineContrib != null &&
                checkins * 2 + misses > 0 &&
                (() => {
                  const interact = checkins * 2 + misses
                  const mineC = Math.min(interact, mineContrib)
                  const taC = interact - mineC
                  return (
                    <>
                      <p className="mb-2 mt-5 px-1 text-sm font-medium text-gray-500">
                        {t('🌿 是你俩一起养大的')}
                      </p>
                      <div className="rounded-2xl bg-white p-3">
                        <div className="flex h-3 overflow-hidden rounded-full bg-gray-100">
                          <div style={{ width: `${(mineC / interact) * 100}%`, background: '#60a5fa' }} />
                          <div style={{ width: `${(taC / interact) * 100}%`, background: '#f9a8d4' }} />
                        </div>
                        <div className="mt-2 flex justify-between text-xs">
                          <span className="font-medium text-sky-500">{t('你 · {n}', { n: mineC })}</span>
                          <span className="font-medium text-pink-400">
                            {t('{name} · {n}', { name: partnerName ?? t('TA'), n: taC })}
                          </span>
                        </div>
                      </div>
                    </>
                  )
                })()}

              {/* 恋爱里程碑徽章墙 */}
              <p className="mb-2 mt-5 px-1 text-sm font-medium text-gray-500">{t('🏅 恋爱里程碑')}</p>
              <div className="grid grid-cols-4 gap-2">
                {badges.map((b) => (
                  <div
                    key={b.label}
                    className={`flex flex-col items-center gap-1 rounded-2xl bg-white p-2 ${
                      b.ok ? '' : 'opacity-60'
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${
                        b.ok ? 'bg-gradient-to-br from-amber-200 to-rose-200' : 'bg-gray-100 grayscale'
                      }`}
                    >
                      {b.ok ? b.icon : '🔒'}
                    </span>
                    <span className="text-center text-[10px] leading-tight text-gray-500">{t(b.label)}</span>
                  </div>
                ))}
              </div>

              {/* 成就阶梯 */}
              <p className="mb-2 mt-5 px-1 text-sm font-medium text-gray-500">{t('🪜 成长阶梯')}</p>
              <div className="space-y-1.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {STAGES.map((s, i) => {
                  const reached = points >= s.min
                  const current = i === stageIdx
                  return (
                    <div
                      key={s.name}
                      className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2 ${
                        current ? 'ring-2 ring-emerald-300' : ''
                      }`}
                    >
                      <span className={`text-2xl ${reached ? '' : 'opacity-30 grayscale'}`}>
                        {s.emoji}
                      </span>
                      <span className={`flex-1 text-sm ${reached ? 'text-gray-700' : 'text-gray-300'}`}>
                        {t(s.name)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {current ? t('🌟 当前') : reached ? '✓' : t('{n} 点', { n: s.min })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* 回忆果实弹窗:点树上的果子打开那段回忆 */}
      {activeMemory && (
        <Portal>
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-8"
            onClick={() => setActiveMemory(null)}
          >
            <div
              className="modal-pop w-full max-w-xs rounded-3xl bg-white p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl">{activeMemory.emoji}</div>
              <p className="mt-2 text-xs font-medium text-emerald-600">{activeMemory.kind}</p>
              <p className="mt-1 whitespace-pre-wrap text-base font-medium text-gray-700">
                {activeMemory.text}
              </p>
              {activeMemory.date && <p className="mt-1 text-xs text-gray-400">{activeMemory.date}</p>}
              <button
                type="button"
                onClick={() => setActiveMemory(null)}
                className="mt-4 w-full rounded-full bg-emerald-400 py-2.5 text-sm font-medium text-white"
              >
                {t('收好这颗回忆')}
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* 升级小电影:跨阶段时的全屏庆祝横幅 */}
      {levelUp && (
        <Portal>
          <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center px-8">
            <div className="modal-pop rounded-3xl bg-white/95 px-7 py-5 text-center shadow-2xl">
              <p className="text-4xl">🌟</p>
              <p className="mt-2 text-sm text-emerald-700">{t('小树长成了')}</p>
              <p className="text-xl font-extrabold text-emerald-600">「{t(levelUp.to)}」</p>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
