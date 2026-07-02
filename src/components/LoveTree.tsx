import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fireEffect } from '../lib/effects'
import { t } from '../lib/i18n'

/**
 * 爱情树(共同养成):不新增表,由你们已有的互动"浇灌"成长——
 * 成长值 = 在一起天数 ×1 + 打卡次数 ×2 + 想你次数 ×1。
 * 「我们」页放一张概览卡,点开进入全屏「爱情树园地」:
 * 天空随时辰变化、树会摇曳、点树说树语、浇水特效、成就阶梯。
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

export default function LoveTree({
  coupleId,
  daysTogether,
}: {
  coupleId: string
  /** 在一起天数(没设在一起日期则传小屋建立天数) */
  daysTogether: number
}) {
  const [checkins, setCheckins] = useState(0)
  const [misses, setMisses] = useState(0)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [talk, setTalk] = useState('')
  const [bouncing, setBouncing] = useState(false)
  const talkTimer = useRef<number | undefined>(undefined)
  const enteredRef = useRef(false)

  const loadCounts = async () => {
    const [c, m] = await Promise.all([
      supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId),
      supabase.from('misses').select('id', { count: 'exact', head: true }).eq('couple_id', coupleId),
    ])
    setCheckins(c.count ?? 0)
    setMisses(m.count ?? 0)
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

  // 升级撒花:本机记录上次阶段,长大到新阶段时庆祝一次
  useEffect(() => {
    if (loading) return
    const prev = Number(localStorage.getItem(STAGE_KEY) ?? '-1')
    if (stageIdx > prev) {
      if (prev >= 0) fireEffect(['🎉', '🌸', '✨', '🌿'], 34)
      localStorage.setItem(STAGE_KEY, String(stageIdx))
    }
  }, [loading, stageIdx])

  // 进入园地:飘一场落叶欢迎(每次打开一次)
  useEffect(() => {
    if (open && !enteredRef.current) {
      enteredRef.current = true
      setTimeout(() => fireEffect(['🍃', '🌿', '✨'], 16), 350)
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
    fireEffect(['💧', '🌿', '✨', '🍃'], 24)
    navigator.vibrate?.([20, 60, 20])
    setBouncing(true)
    setTimeout(() => setBouncing(false), 650)
    say(t('咕嘟咕嘟…谢谢浇水!多打卡、多想 TA,我长得更快哦 🌱'))
    void loadCounts() // 顺便刷新(对方可能刚打卡/想你)
  }

  const sky = skyByHour(new Date().getHours())

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
        <div className="mt-2 flex items-center gap-4">
          <span className="text-5xl">{loading ? '🌱' : stage.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-emerald-700">{t(stage.name)}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
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

      {/* 爱情树园地(全屏页) */}
      {open && (
        <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col overflow-hidden bg-warmbg">
          {/* 天空场景 */}
          <div
            className="relative shrink-0 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]"
            style={{ background: sky.bg }}
          >
            <div className="flex items-center px-3">
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

            {/* 夜晚点缀星星 / 白天点缀云 */}
            <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-around text-sm opacity-80">
              {sky.night ? (
                <>
                  <span className="deco-twinkle inline-block">✨</span>
                  <span className="deco-twinkle inline-block" style={{ animationDelay: '0.7s' }}>⭐</span>
                  <span className="deco-twinkle inline-block" style={{ animationDelay: '1.3s' }}>✨</span>
                </>
              ) : (
                <>
                  <span className="deco-float inline-block">☁️</span>
                  <span className="deco-float inline-block" style={{ animationDelay: '1s' }}>🕊️</span>
                  <span className="deco-float inline-block" style={{ animationDelay: '2s' }}>☁️</span>
                </>
              )}
            </div>

            {/* 树语气泡 */}
            <div className="flex h-10 items-end justify-center px-8">
              {talk && (
                <span className="modal-pop max-w-full rounded-2xl rounded-bl-sm bg-white/90 px-3 py-1.5 text-xs text-emerald-800 shadow">
                  {talk}
                </span>
              )}
            </div>

            {/* 树本体:点一点会说话 */}
            <button
              type="button"
              onClick={pokeTree}
              className="mx-auto block select-none text-center"
              aria-label="戳戳爱情树"
            >
              <span className={`text-8xl drop-shadow-lg ${bouncing ? 'tree-bounce' : 'tree-sway'}`}>
                {loading ? '🌱' : stage.emoji}
              </span>
            </button>
            {/* 草地 */}
            <div className="pointer-events-none mx-auto -mb-2 mt-1 h-4 w-56 rounded-[100%] bg-emerald-300/70 blur-[2px]" />
            <p
              className={`mt-2 text-center text-sm font-semibold ${
                sky.night ? 'text-white' : 'text-emerald-800'
              }`}
            >
              {t(stage.name)}
              <span className={`ml-2 text-xs font-normal ${sky.night ? 'text-white/70' : 'text-emerald-700/70'}`}>
                {t('浇灌值 {p}', { p: points })}
              </span>
            </p>
            {next && (
              <div className="mx-auto mt-2 w-2/3">
                <div className="h-2 overflow-hidden rounded-full bg-white/40">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
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
                <p className="mt-1 text-lg font-bold text-emerald-700">{daysTogether}</p>
                <p className="text-xs text-gray-400">{t('在一起天数 ×1')}</p>
              </div>
              <div className="rounded-2xl bg-white p-3 text-center">
                <p className="text-xl">📍</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">{checkins}</p>
                <p className="text-xs text-gray-400">{t('打卡次数 ×2')}</p>
              </div>
              <div className="rounded-2xl bg-white p-3 text-center">
                <p className="text-xl">💭</p>
                <p className="mt-1 text-lg font-bold text-emerald-700">{misses}</p>
                <p className="text-xs text-gray-400">{t('想你次数 ×1')}</p>
              </div>
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
      )}
    </>
  )
}
