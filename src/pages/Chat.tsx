import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useMessages } from '../hooks/useMessages'
import { useReadStatus } from '../hooks/useReadStatus'
import MessageBubble from '../components/MessageBubble'
import ChatPanel from '../components/ChatPanel'
import ChatSearch from '../components/ChatSearch'
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
  } = useMessages(couple!.id, userId)

  const [draft, setDraft] = useState('')
  const [viewer, setViewer] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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
      if (it.id !== undefined && it.senderId === userId) return it.key
    }
    return null
  }, [items, userId])

  const partnerReadId = useReadStatus(couple!.id, userId, latestServerId)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // 是否"贴在底部":贴底时新消息到达自动滚到底,翻历史时则不打扰
  const stickRef = useRef(true)

  useLayoutEffect(() => {
    const el = listRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [items.length, loadingInitial])

  const onScroll = () => {
    const el = listRef.current
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    stickRef.current = true
    sendText(draft)
    setDraft('')
  }

  const handlePickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    stickRef.current = true
    try {
      await sendImage(file)
    } catch {
      setToast('无法读取这张图片,请换一张试试')
      setTimeout(() => setToast(''), 2500)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="relative border-b border-line bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
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
          onClick={() => setSearchOpen(true)}
          className="absolute bottom-2.5 right-4 text-lg text-gray-400"
          aria-label="查找聊天记录"
        >
          🔍
        </button>
      </header>

      {/* 消息列表 */}
      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-3">
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
              return (
                <div key={item.key} className="mb-2">
                  {showDivider && (
                    <p className="my-3 text-center text-xs text-gray-300">
                      {formatDivider(item.createdAt)}
                    </p>
                  )}
                  <MessageBubble
                    item={item}
                    mine={item.senderId === userId}
                    readLabel={
                      item.key === myLastKey &&
                      item.id !== undefined &&
                      partnerReadId >= item.id
                    }
                    onRetry={() => retrySend(item.key)}
                    onPreview={(url) => setViewer(url)}
                  />
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* 输入栏 */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-line bg-white px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
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
          onClose={() => setSearchOpen(false)}
        />
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
        <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center">
          <span className="rounded-full bg-gray-800/80 px-4 py-2 text-sm text-white">{toast}</span>
        </div>
      )}
    </div>
  )
}
