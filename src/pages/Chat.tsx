import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ChangeEvent, FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useMessages } from '../hooks/useMessages'
import type { ChatItem } from '../hooks/useMessages'
import { useReadStatus } from '../hooks/useReadStatus'
import { CHAT_BGS, getBubbleStyle, getChatBgToken } from '../lib/prefs'
import { getSignedUrl } from '../lib/storage'
import MessageBubble from '../components/MessageBubble'
import ChatPanel from '../components/ChatPanel'
import ChatSearch from '../components/ChatSearch'
import ChatAppearance from '../components/ChatAppearance'
import PartnerClock from '../components/PartnerClock'

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
  if (sameDay(d, yesterday)) return `昨天 ${hm}`
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
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
  const [actionTarget, setActionTarget] = useState<ChatItem | null>(null)
  const [highlightId, setHighlightId] = useState<number | null>(null)

  // 聊天外观(本机偏好)
  const [bubble, setBubble] = useState(getBubbleStyle)
  const [bgToken, setBgToken] = useState(getChatBgToken)
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null)

  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // 是否"贴在底部":贴底时新消息到达自动滚到底,翻历史时则不打扰
  const stickRef = useRef(true)

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
    sendText(draft)
    setDraft('')
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
      showToast('无法读取这张图片,请换一张试试')
    }
  }

  /** 从搜索结果定位到聊天中的某条消息 */
  const locate = async (id: number) => {
    setSearchOpen(false)
    stickRef.current = false
    const ok = await jumpTo(id)
    if (!ok) {
      showToast('定位失败,请重试')
      return
    }
    setHighlightId(id)
    setTimeout(() => {
      document.getElementById(`msg-${id}`)?.scrollIntoView({ block: 'center' })
    }, 60)
    setTimeout(() => setHighlightId(null), 2200)
  }

  /** 长按菜单:撤回 */
  const handleRecall = async () => {
    const t = actionTarget
    setActionTarget(null)
    if (!t?.id) return
    try {
      await recallMessage(t.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('RECALL_TIMEOUT')) showToast('发出超过 2 分钟,不能撤回了')
      else showToast('撤回失败,请重试')
    }
  }

  /** 长按菜单:复制 */
  const handleCopy = async () => {
    const t = actionTarget
    setActionTarget(null)
    if (!t) return
    try {
      await navigator.clipboard.writeText(t.content)
      showToast('已复制')
    } catch {
      showToast('复制失败,长按文字手动选择吧')
    }
  }

  const canRecall = (it: ChatItem) =>
    it.senderId === userId &&
    it.status === 'sent' &&
    it.id !== undefined &&
    Date.now() - new Date(it.createdAt).getTime() < RECALL_WINDOW

  return (
    <div className="flex h-full flex-col">
      <header className="relative border-b border-line bg-white/85 backdrop-blur-md px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-base font-semibold text-primary-dark">
          ❤ {couple?.name ?? '双人小屋'}
        </h1>
        {partner?.timezone && (
          <p className="text-xs text-gray-400">
            <PartnerClock tz={partner.timezone} />
          </p>
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
          <p className="py-10 text-center text-sm text-gray-300">加载中…</p>
        ) : initialError ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-gray-400">消息加载失败</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-full border border-primary px-4 py-1.5 text-sm text-primary-dark"
            >
              重新加载
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
                {loadingOlder ? '加载中…' : '查看更早的消息'}
              </button>
            )}
            {items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-gray-300">
                <span className="text-4xl">💬</span>
                <p className="text-sm">说点什么,开启你们的小屋吧</p>
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
                    readLabel={
                      item.key === myLastKey &&
                      item.id !== undefined &&
                      partnerReadId >= item.id
                    }
                    onRetry={() => retrySend(item.key)}
                    onPreview={(url) => setViewer(url)}
                    onLongPress={longPressable ? () => setActionTarget(item) : undefined}
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
                查看更新的消息
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
          ↓ 回到最新
        </button>
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
        <input
          className="min-w-0 flex-1 rounded-full border border-line bg-warmbg px-4 py-2 text-base outline-none focus:border-primary"
          placeholder="说点什么…"
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
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
          发送
        </button>
      </form>

      {/* 表情 / 表情包面板 */}
      {panelOpen && (
        <ChatPanel
          coupleId={couple!.id}
          userId={userId}
          onEmoji={(e) => setDraft((d) => d + e)}
          onSticker={(path) => {
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
            setBgToken(getChatBgToken())
          }}
          onClose={() => setAppearanceOpen(false)}
          onToast={showToast}
        />
      )}

      {/* 长按操作菜单 */}
      {actionTarget && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={() => setActionTarget(null)}
        >
          <div
            className="mx-auto w-full max-w-md rounded-t-2xl bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="divide-y divide-line">
              {actionTarget.type === 'text' && (
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="w-full py-3.5 text-center active:bg-soft"
                >
                  📋 复制
                </button>
              )}
              {canRecall(actionTarget) && (
                <button
                  type="button"
                  onClick={() => void handleRecall()}
                  className="w-full py-3.5 text-center text-red-500 active:bg-soft"
                >
                  ↩️ 撤回
                </button>
              )}
            </div>
            <button
              type="button"
              className="mt-2 w-full border-t border-line py-3.5 text-center text-gray-500"
              onClick={() => setActionTarget(null)}
            >
              取消
            </button>
          </div>
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
