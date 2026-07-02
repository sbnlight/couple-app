import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useMessages } from '../hooks/useMessages'
import type { ChatItem } from '../hooks/useMessages'
import { useReadStatus } from '../hooks/useReadStatus'
import { CHAT_BGS, getBubbleFont, getBubbleStyle, getChatBgToken } from '../lib/prefs'
import { getSignedUrl } from '../lib/storage'
import { onLive, onPartnerInChat, sendLive, trackInChat } from '../lib/live'
import { fireEffect, keywordEffect } from '../lib/effects'
import { weatherForTz } from '../lib/weather'
import MessageBubble from '../components/MessageBubble'
import ChatPanel from '../components/ChatPanel'
import ChatSearch from '../components/ChatSearch'
import ChatAppearance from '../components/ChatAppearance'
import PartnerClock from '../components/PartnerClock'
import { moodValid } from '../components/MoodCard'
import { t } from '../lib/i18n'

/** 时间条文案:今天只显时分;昨天/今年/更早逐级加详 */
function formatDivider(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, now)) return hm
  if (sameDay(d, yesterday)) return `${t('昨天')} ${hm}`
  if (d.getFullYear() === now.getFullYear())
    return `${t('{m}月{d}日', { m: d.getMonth() + 1, d: d.getDate() })} ${hm}`
  return `${t('{y}年{m}月{d}日', { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() })} ${hm}`
}

/** 相邻消息间隔超过 5 分钟时显示时间条 */
const DIVIDER_GAP = 5 * 60 * 1000
/** 发出后多久内可撤回(与数据库 RPC 一致) */
const RECALL_WINDOW = 2 * 60 * 1000

export default function Chat() {
  const { couple, session, partner } = useAuth()
  // 本页在 RequireCouple 守卫内,couple/session 必然存在
  const userId = session!.user.id
  const {
    items,
    loadingInitial,
    initialError,
    reload,
    hasMore,
    loadingOlder,
    loadOlder,
    sendText,
    sendImage,
    sendSticker,
    sendVoice,
    sendNudge,
    retrySend,
    recallMessage,
    mode,
    hasNewer,
    jumpTo,
    loadNewer,
    backToLatest,
  } = useMessages(couple!.id, userId)

  const [draft, setDraft] = useState('')
  const [viewer, setViewer] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [actionTarget, setActionTarget] = useState<{ item: ChatItem; rect: DOMRect } | null>(
    null,
  )
  const [replyTarget, setReplyTarget] = useState<ChatItem | null>(null)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /** 一条消息的简短预览(引用栏/引用框用) */
  const previewOf = (it: ChatItem) =>
    it.type === 'text'
      ? it.content.slice(0, 40)
      : it.type === 'image'
        ? t('🖼 [图片]')
        : it.type === 'sticker'
          ? t('⭐ [表情包]')
          : it.type === 'voice'
            ? t('🎤 [语音]')
            : t('消息')

  // 聊天外观(本机偏好)
  const [bubble, setBubble] = useState(getBubbleStyle)
  const [bubbleFont, setBubbleFont] = useState(getBubbleFont)
  const [bgToken, setBgToken] = useState(getChatBgToken)
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // 是否"贴在底部":贴底时新消息到达自动滚到底,翻历史时则不打扰
  const stickRef = useRef(true)

  // ---- 互动状态:在场 / 正在输入 / 天气 / 抖动 / 录音 ----
  const [partnerIn, setPartnerIn] = useState(false)
  const [typingUntil, setTypingUntil] = useState(0)
  const [, typingTick] = useState(0)
  const [weather, setWeather] = useState<{ emoji: string; temp: number } | null>(null)
  const [shake, setShake] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recElapsed, setRecElapsed] = useState(0)
  const lastTypingSentRef = useRef(0)
  const prevMaxRef = useRef<number | null>(null)
  const recRef = useRef<{
    mr: MediaRecorder
    chunks: Blob[]
    start: number
    stream: MediaStream
  } | null>(null)
  const recTimerRef = useRef<number | undefined>(undefined)
  // 录音"正在启动中"(getUserMedia 授权 / backToLatest 仍在 await):
  // 此时 recRef 还是 null,若用户已松手需记下意图,拿到流后立即释放
  const recStartingRef = useRef(false)
  // 启动期间收到的停止请求:null=无;true=松手发送;false=取消丢弃
  const pendingStopRef = useRef<boolean | null>(null)

  // 在场:进入聊天页让对方看到呼吸光点;同时订阅对方的在场与输入状态
  useEffect(() => {
    trackInChat(true)
    const offPresence = onPartnerInChat(setPartnerIn)
    const offTyping = onLive('typing', () => setTypingUntil(Date.now() + 3500))
    return () => {
      trackInChat(false)
      offPresence()
      offTyping()
    }
  }, [])

  // "正在输入"过期自动消失。注意:typingUntil 到点后该值不再变化,effect 不会重跑,
  // 因此必须在 tick 内部检测过期并 clearInterval 自停,否则会残留一个每秒触发整页
  // 重渲染的定时器(直到下次 typing 事件或卸载),持续耗电/掉帧。
  useEffect(() => {
    if (typingUntil <= Date.now()) return
    const timer = setInterval(() => {
      if (Date.now() >= typingUntil) {
        clearInterval(timer)
        typingTick((x) => x + 1) // 触发一次重渲染,让"正在输入"消失
        return
      }
      typingTick((x) => x + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [typingUntil])
  const partnerTyping = typingUntil > Date.now()

  // 对方城市天气
  useEffect(() => {
    let cancelled = false
    void weatherForTz(partner?.timezone ?? null).then((w) => {
      if (!cancelled) setWeather(w)
    })
    return () => {
      cancelled = true
    }
  }, [partner?.timezone])

  // 新到消息的反应:对方文本命中关键词 → 表情雨;对方拍一拍 → 震动+抖动
  useEffect(() => {
    if (loadingInitial) return
    const maxId = (() => {
      for (let i = items.length - 1; i >= 0; i--) {
        const id = items[i].id
        if (id !== undefined) return id
      }
      return 0
    })()
    if (prevMaxRef.current === null) {
      prevMaxRef.current = maxId
      return
    }
    if (maxId <= prevMaxRef.current) return
    const since = prevMaxRef.current
    prevMaxRef.current = maxId
    for (const it of items) {
      if (it.id === undefined || it.id <= since) continue
      if (it.senderId === userId) continue
      if (Date.now() - new Date(it.createdAt).getTime() > 20_000) continue
      if (it.type === 'text' && !it.recalled) {
        const fx = keywordEffect(it.content)
        if (fx) fireEffect(fx)
      } else if (it.type === 'nudge') {
        navigator.vibrate?.(200)
        setShake(true)
        setTimeout(() => setShake(false), 500)
      }
    }
  }, [items, loadingInitial, userId])

  // ---- 语音录制(按住说话) ----
  const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return null
    for (const m of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']) {
      if (MediaRecorder.isTypeSupported(m)) return m
    }
    return ''
  }

  const stopRec = (send: boolean) => {
    const r = recRef.current
    if (!r) {
      // 录音尚未真正开始(授权框/backToLatest 还在进行):记下停止意图,
      // startRec 拿到麦克风流后据此立即释放,避免"松手了却一直录到 60s"
      if (recStartingRef.current) pendingStopRef.current = send
      return
    }
    window.clearInterval(recTimerRef.current)
    const durSec = (Date.now() - r.start) / 1000
    r.mr.onstop = () => {
      r.stream.getTracks().forEach((t) => t.stop())
      recRef.current = null
      setRecording(false)
      if (!send) return
      if (durSec < 1) {
        showToast(t('太短啦,按住说话'))
        return
      }
      const mime = r.mr.mimeType || 'audio/mp4'
      const blob = new Blob(r.chunks, { type: mime })
      const ext = mime.includes('mp4') ? 'm4a' : 'webm'
      stickRef.current = true
      sendVoice(blob, durSec, ext, mime)
    }
    try {
      r.mr.stop()
    } catch {
      recRef.current = null
      setRecording(false)
    }
  }

  const startRec = async () => {
    if (recording || recStartingRef.current) return
    const mime = pickMime()
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      showToast(t('这个浏览器不支持录音'))
      return
    }
    recStartingRef.current = true
    pendingStopRef.current = null
    try {
      if (mode === 'history') await backToLatest()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // 授权/切换期间用户已松手或取消:不真正开始,立即释放麦克风流
      if (pendingStopRef.current !== null) {
        stream.getTracks().forEach((tk) => tk.stop())
        return
      }
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recRef.current = { mr, chunks, start: Date.now(), stream }
      mr.start()
      setRecording(true)
      setRecElapsed(0)
      recTimerRef.current = window.setInterval(() => {
        const el = (Date.now() - (recRef.current?.start ?? Date.now())) / 1000
        setRecElapsed(Math.floor(el))
        if (el >= 60) stopRec(true) // 60 秒上限自动发送
      }, 250)
    } catch {
      showToast(t('无法使用麦克风,请检查权限设置'))
    } finally {
      recStartingRef.current = false
    }
  }

  // 卸载(如切到别的 Tab)时兜底停止录音并释放麦克风流,避免指示灯常亮/流泄漏
  useEffect(() => {
    return () => {
      window.clearInterval(recTimerRef.current)
      const r = recRef.current
      if (r) {
        try {
          r.mr.onstop = null
          r.mr.stop()
        } catch {
          // 忽略:MediaRecorder 可能已停止
        }
        r.stream.getTracks().forEach((tk) => tk.stop())
        recRef.current = null
      }
    }
  }, [])

  // 自定义背景:解析签名 URL
  useLayoutEffect(() => {
    if (!bgToken.startsWith('custom:')) {
      setCustomBgUrl(null)
      return
    }
    let cancelled = false
    getSignedUrl('avatars', bgToken.slice(7)).then((u) => {
      if (!cancelled) setCustomBgUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [bgToken])

  const bgStyle = useMemo<CSSProperties | undefined>(() => {
    if (bgToken.startsWith('preset:')) {
      const css = CHAT_BGS.find((b) => b.id === bgToken.slice(7))?.css
      return css ? { background: css } : undefined
    }
    if (customBgUrl) {
      return {
        backgroundImage: `url(${customBgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    }
    return undefined
  }, [bgToken, customBgUrl])

  // 本地已加载的最新服务端消息 id(作为自己的已读位置上报)
  const latestServerId = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const id = items[i].id
      if (id !== undefined) return id
    }
    return 0
  }, [items])

  // 自己发出的最后一条已落库消息(只在它下面标「已读」)
  const myLastKey = useMemo(() => {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]
      if (it.id !== undefined && it.senderId === userId && !it.recalled) return it.key
    }
    return null
  }, [items, userId])

  const partnerReadId = useReadStatus(couple!.id, userId, mode === 'live' ? latestServerId : 0)

  useLayoutEffect(() => {
    const el = listRef.current
    if (el && stickRef.current && mode === 'live') el.scrollTop = el.scrollHeight
  }, [items.length, loadingInitial, mode])

  const onScroll = () => {
    const el = listRef.current
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  // 图片/表情包异步加载完成后,<img> 撑高发生在上面 items 贴底 effect 之后,
  // 若此时仍贴在底部则重新滚到底,避免自己发图/收图后停在图片上方
  const scrollBottomOnMedia = () => {
    const el = listRef.current
    if (el && stickRef.current && mode === 'live') el.scrollTop = el.scrollHeight
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  /** 加载更早消息并保持滚动位置不跳动 */
  const handleLoadOlder = async () => {
    const el = listRef.current
    const prevHeight = el?.scrollHeight ?? 0
    await loadOlder()
    setTimeout(() => {
      if (el) el.scrollTop += el.scrollHeight - prevHeight
    }, 0)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    // 历史浏览中发消息:先回到最新再发,避免消息"落"在历史窗口里
    if (mode === 'history') await backToLatest()
    stickRef.current = true
    const fx = keywordEffect(draft)
    if (fx) fireEffect(fx)
    const reply =
      replyTarget?.id !== undefined
        ? { id: replyTarget.id, preview: previewOf(replyTarget) }
        : undefined
    sendText(draft, reply)
    setDraft('')
    setReplyTarget(null)
  }

  const handlePickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (mode === 'history') await backToLatest()
    stickRef.current = true
    try {
      await sendImage(file)
    } catch {
      showToast(t('无法读取这张图片,请换一张试试'))
    }
  }

  /** 从搜索结果定位到聊天中的某条消息 */
  const locate = async (id: number) => {
    setSearchOpen(false)
    stickRef.current = false
    const ok = await jumpTo(id)
    if (!ok) {
      showToast(t('定位失败,请重试'))
      return
    }
    setHighlightId(id)
    setTimeout(() => {
      document.getElementById(`msg-${id}`)?.scrollIntoView({ block: 'center' })
    }, 60)
    setTimeout(() => setHighlightId(null), 2200)
  }

  /** 菜单:撤回 */
  const handleRecall = async () => {
    const it = actionTarget?.item
    setActionTarget(null)
    if (!it?.id) return
    try {
      await recallMessage(it.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('RECALL_TIMEOUT')) showToast(t('发出超过 2 分钟,不能撤回了'))
      else showToast(t('撤回失败,请重试'))
    }
  }

  /** 菜单:复制 */
  const handleCopy = async () => {
    const it = actionTarget?.item
    setActionTarget(null)
    if (!it) return
    try {
      await navigator.clipboard.writeText(it.content)
      showToast(t('已复制'))
    } catch {
      showToast(t('复制失败,长按文字手动选择吧'))
    }
  }

  /** 菜单:引用回复 */
  const handleQuote = () => {
    const it = actionTarget?.item
    setActionTarget(null)
    if (!it) return
    setReplyTarget(it)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const canRecall = (it: ChatItem) =>
    it.senderId === userId &&
    it.status === 'sent' &&
    it.id !== undefined &&
    Date.now() - new Date(it.createdAt).getTime() < RECALL_WINDOW

  return (
    <div className={`flex h-full flex-col ${shake ? 'chat-shake' : ''}`}>
      <header className="relative border-b border-line bg-white/85 backdrop-blur-md px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-base font-semibold text-primary-dark">
          {partnerIn && <span className="presence-dot mr-1.5 align-middle" title="TA 正在聊天页" />}
          ❤ {couple?.name ?? '双人小屋'}
        </h1>
        {partnerTyping ? (
          <p className="text-xs text-primary-dark">{t('对方正在输入…')}</p>
        ) : (
          (partner?.timezone || moodValid(partner)) && (
            <p className="text-xs text-gray-400">
              <PartnerClock tz={partner?.timezone ?? null} />
              {weather && (
                <>
                  {' '}
                  · {weather.emoji} {weather.temp}°C
                </>
              )}
              {moodValid(partner) && <> · {moodValid(partner)}</>}
            </p>
          )
        )}
        <button
          type="button"
          onClick={() => setAppearanceOpen(true)}
          className="absolute bottom-2.5 left-4 text-lg"
          aria-label="聊天外观"
        >
          🎨
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="absolute bottom-2.5 right-4 text-lg text-gray-400"
          aria-label="查找聊天记录"
        >
          🔍
        </button>
      </header>

      {/* 消息列表 */}
      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-3 py-3"
        style={bgStyle}
      >
        {loadingInitial ? (
          <p className="py-10 text-center text-sm text-gray-300">{t('加载中…')}</p>
        ) : initialError ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-gray-400">{t('消息加载失败')}</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-full border border-primary px-4 py-1.5 text-sm text-primary-dark"
            >
              {t('重新加载')}
            </button>
          </div>
        ) : (
          <>
            {hasMore && (
              <button
                type="button"
                onClick={() => void handleLoadOlder()}
                disabled={loadingOlder}
                className="mx-auto mb-3 block rounded-full bg-white px-4 py-1.5 text-xs text-gray-400"
              >
                {loadingOlder ? t('加载中…') : t('查看更早的消息')}
              </button>
            )}
            {items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-gray-300">
                <span className="text-4xl">💬</span>
                <p className="text-sm">{t('说点什么,开启你们的小屋吧')}</p>
              </div>
            )}
            {items.map((item, i) => {
              const prev = items[i - 1]
              const showDivider =
                !prev ||
                new Date(item.createdAt).getTime() - new Date(prev.createdAt).getTime() >
                  DIVIDER_GAP
              const longPressable = item.type === 'text' || canRecall(item)
              return (
                <div
                  key={item.key}
                  id={item.id !== undefined ? `msg-${item.id}` : undefined}
                  className={`msg-in mb-2 rounded-2xl ${
                    highlightId !== null && item.id === highlightId ? 'msg-highlight' : ''
                  }`}
                >
                  {showDivider && (
                    <p className="my-3 text-center text-xs text-gray-300">
                      {formatDivider(item.createdAt)}
                    </p>
                  )}
                  <MessageBubble
                    item={item}
                    mine={item.senderId === userId}
                    bubble={bubble}
                    font={bubbleFont}
                    readLabel={
                      item.key === myLastKey &&
                      item.id !== undefined &&
                      partnerReadId >= item.id
                    }
                    onRetry={() => retrySend(item.key)}
                    onPreview={(url) => setViewer(url)}
                    onMediaLoad={scrollBottomOnMedia}
                    onLongPress={
                      longPressable ? (rect) => setActionTarget({ item, rect }) : undefined
                    }
                    onDoubleTap={
                      item.senderId !== userId && item.id !== undefined
                        ? async () => {
                            if (mode === 'history') await backToLatest()
                            navigator.vibrate?.(60)
                            sendNudge()
                          }
                        : undefined
                    }
                  />
                </div>
              )
            })}
            {hasNewer && (
              <button
                type="button"
                onClick={() => void loadNewer()}
                className="mx-auto mt-1 block rounded-full bg-white px-4 py-1.5 text-xs text-gray-400"
              >
                {t('查看更新的消息')}
              </button>
            )}
          </>
        )}
      </div>

      {/* 历史浏览中:一键回到最新 */}
      {mode === 'history' && (
        <button
          type="button"
          onClick={() => {
            stickRef.current = true
            void backToLatest()
          }}
          className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50vw-13rem))] rounded-full bg-primary px-3.5 py-2 text-sm text-white shadow-lg"
        >
          {t('↓ 回到最新')}
        </button>
      )}

      {/* 引用编辑栏 */}
      {replyTarget && (
        <div className="flex items-center gap-2 border-t border-line bg-white/85 px-3 py-1.5 text-xs text-gray-500 backdrop-blur-md">
          <span className="min-w-0 flex-1 truncate border-l-2 border-primary pl-2">
            {t('引用')}: {previewOf(replyTarget)}
          </span>
          <button type="button" onClick={() => setReplyTarget(null)} className="px-1 text-gray-400">
            ✕
          </button>
        </div>
      )}

      {/* 输入栏 */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex items-center gap-2 border-t border-line bg-white/85 backdrop-blur-md px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-2xl leading-none"
          aria-label="发送图片"
        >
          📷
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            // 捕获指针:手指/鼠标即使滑出小按钮,pointerup 仍回到本按钮,
            // 不会因轻微滑动误触发"取消录音"(移动端极易误触)
            e.currentTarget.setPointerCapture(e.pointerId)
            void startRec()
          }}
          onPointerUp={() => stopRec(true)}
          onPointerCancel={() => stopRec(false)}
          onContextMenu={(e) => e.preventDefault()}
          className={`select-none text-2xl leading-none ${recording ? 'scale-125' : ''}`}
          style={{ touchAction: 'none' }}
          aria-label="按住说话"
        >
          🎤
        </button>
        <input
          ref={inputRef}
          className="min-w-0 flex-1 rounded-full border border-line bg-warmbg px-4 py-2 text-base outline-none focus:border-primary"
          placeholder={t('说点什么…')}
          maxLength={2000}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            // 节流广播"正在输入"
            if (e.target.value && Date.now() - lastTypingSentRef.current > 2000) {
              lastTypingSentRef.current = Date.now()
              sendLive('typing')
            }
          }}
          onFocus={() => setPanelOpen(false)}
        />
        <button
          type="button"
          onClick={() => setPanelOpen(!panelOpen)}
          className="text-2xl leading-none"
          aria-label="表情"
        >
          {panelOpen ? '⌨️' : '😊'}
        </button>
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-full bg-primary px-4 py-2 text-base text-white disabled:opacity-40"
        >
          {t('发送')}
        </button>
      </form>

      {/* 表情 / 表情包面板 */}
      {panelOpen && (
        <ChatPanel
          coupleId={couple!.id}
          userId={userId}
          onEmoji={(e) => setDraft((d) => d + e)}
          onSticker={async (path) => {
            // 从搜索进入历史窗口时,先回到最新再发,否则新消息会错落进旧窗口末尾
            if (mode === 'history') await backToLatest()
            stickRef.current = true
            sendSticker(path)
          }}
          onToast={showToast}
        />
      )}

      {/* 聊天记录查找 */}
      {searchOpen && (
        <ChatSearch
          coupleId={couple!.id}
          userId={userId}
          partnerName={partner?.display_name ?? 'TA'}
          onLocate={(id) => void locate(id)}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {/* 聊天外观设置 */}
      {appearanceOpen && (
        <ChatAppearance
          userId={userId}
          onChanged={() => {
            setBubble(getBubbleStyle())
            setBubbleFont(getBubbleFont())
            setBgToken(getChatBgToken())
          }}
          onClose={() => setAppearanceOpen(false)}
          onToast={showToast}
        />
      )}

      {/* 长按操作菜单:在气泡上方(空间不够则下方)弹出 */}
      {actionTarget && (
        <div className="fixed inset-0 z-50" onClick={() => setActionTarget(null)}>
          {(() => {
            const r = actionTarget.rect
            const below = r.top < 110
            const top = below ? r.bottom + 8 : r.top - 8
            const left = Math.min(Math.max(r.left + r.width / 2, 80), window.innerWidth - 80)
            return (
              <div
                className="absolute flex items-stretch overflow-hidden rounded-xl bg-gray-800/95 text-sm text-white shadow-xl backdrop-blur-sm"
                style={{ left, top, transform: `translate(-50%, ${below ? '0' : '-100%'})` }}
                onClick={(e) => e.stopPropagation()}
              >
                {actionTarget.item.type === 'text' && (
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="px-4 py-2.5 active:bg-white/15"
                  >
                    {t('复制')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleQuote}
                  className="border-l border-white/15 px-4 py-2.5 active:bg-white/15"
                >
                  {t('引用')}
                </button>
                {canRecall(actionTarget.item) && (
                  <button
                    type="button"
                    onClick={() => void handleRecall()}
                    className="border-l border-white/15 px-4 py-2.5 text-red-300 active:bg-white/15"
                  >
                    {t('撤回')}
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* 隐藏的图片选择器 */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handlePickImage(e)}
      />

      {/* 录音中浮层 */}
      {recording && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-gray-800/85 px-8 py-6 text-white">
            <span className="animate-pulse text-4xl">🎙</span>
            <span className="font-mono text-lg">{recElapsed}s</span>
            <span className="text-xs text-white/70">{t('松开发送 · 最长 60 秒')}</span>
          </div>
        </div>
      )}

      {/* 全屏看图 */}
      {viewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setViewer(null)}
        >
          <img src={viewer} alt="查看图片" className="max-h-full max-w-full object-contain" />
        </div>
      )}

      {/* 轻提示 */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex justify-center">
          <span className="rounded-full bg-gray-800/80 px-4 py-2 text-sm text-white">{toast}</span>
        </div>
      )}
    </div>
  )
}
