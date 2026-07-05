import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import MessageBubble from './MessageBubble'
import type { ChatItem } from '../hooks/useMessages'
import type { Message } from '../types/db'
import { t } from '../lib/i18n'

const PAGE = 50

/** 把命中的关键词高亮(CSP 安全:不用 innerHTML,按索引切分包 <mark>) */
function Highlight({ text, q }: { text: string; q: string }) {
  const query = q.trim()
  if (!query) return <>{text}</>
  const ql = query.toLowerCase()
  const lower = text.toLowerCase()
  const out: Array<string | JSX.Element> = []
  let i = 0
  let k = 0
  while (i < text.length) {
    const idx = lower.indexOf(ql, i)
    if (idx < 0) {
      out.push(text.slice(i))
      break
    }
    if (idx > i) out.push(text.slice(i, idx))
    out.push(
      <mark key={k++} className="rounded bg-primary-light px-0.5 text-primary-dark">
        {text.slice(idx, idx + query.length)}
      </mark>,
    )
    i = idx + query.length
  }
  return <>{out}</>
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toItem(m: Message): ChatItem {
  return {
    key: `s-${m.id}`,
    id: m.id,
    type: m.type,
    content: m.content,
    senderId: m.sender_id,
    createdAt: m.created_at,
    status: 'sent',
    // 与主聊天的映射保持一致:带上撤回态与引用/气泡字段,否则上下文查看器里
    // 已撤回消息会渲染成空气泡 / 卡在图片骨架 / 假「待发送」语音。
    recalled: m.recalled,
    replyPreview: m.reply_preview,
    replyTo: m.reply_to,
    bubbleId: m.bubble_id,
    bubbleFont: m.bubble_font,
  }
}

/**
 * 聊天记录查找:关键词 / 日期 / 只看图片 / 按发送人 组合筛选;
 * 点结果可查看该消息前后的上下文。
 */
export default function ChatSearch({
  coupleId,
  userId,
  partnerName,
  onLocate,
  onClose,
}: {
  coupleId: string
  userId: string
  partnerName: string
  /** 点击结果:回到聊天并定位到该条消息 */
  onLocate: (id: number) => void
  onClose: () => void
}) {
  const [keyword, setKeyword] = useState('')
  const [sender, setSender] = useState<'all' | 'me' | 'ta'>('all')
  const [date, setDate] = useState('')
  const [imagesOnly, setImagesOnly] = useState(false)
  const [results, setResults] = useState<Message[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [context, setContext] = useState<{ list: Message[]; targetId: number } | null>(null)
  const [viewer, setViewer] = useState<string | null>(null)
  const cursorRef = useRef<number | null>(null)

  const hasCondition = keyword.trim() !== '' || date !== '' || imagesOnly

  const runSearch = async (reset: boolean) => {
    if (!hasCondition || loading) return
    setLoading(true)
    if (reset) {
      cursorRef.current = null
      setResults([])
    }
    let q = supabase
      .from('messages')
      .select('*')
      .eq('couple_id', coupleId)
      .order('id', { ascending: false })
      .limit(PAGE)
    if (cursorRef.current !== null) q = q.lt('id', cursorRef.current)
    if (imagesOnly) {
      q = q.eq('type', 'image')
    } else if (keyword.trim()) {
      // 转义 like 通配符,按内容模糊匹配(只搜文本消息)
      const esc = keyword.trim().replace(/[\\%_]/g, (m) => `\\${m}`)
      q = q.eq('type', 'text').ilike('content', `%${esc}%`)
    }
    if (sender === 'me') q = q.eq('sender_id', userId)
    if (sender === 'ta') q = q.neq('sender_id', userId)
    if (date) {
      const [y, m, d] = date.split('-').map(Number)
      const start = new Date(y, m - 1, d)
      const end = new Date(y, m - 1, d + 1)
      q = q.gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
    }
    const { data, error } = await q
    if (!error && data) {
      const rows = data as Message[]
      setResults((prev) => (reset ? rows : [...prev, ...rows]))
      setHasMore(rows.length === PAGE)
      if (rows.length > 0) cursorRef.current = rows[rows.length - 1].id
    }
    setSearched(true)
    setLoading(false)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void runSearch(true)
  }

  /** 查看某条消息的上下文(前 20 条 + 后 20 条) */
  const openContext = async (target: Message) => {
    const [beforeRes, afterRes] = await Promise.all([
      supabase
        .from('messages')
        .select('*')
        .eq('couple_id', coupleId)
        .lte('id', target.id)
        .order('id', { ascending: false })
        .limit(21),
      supabase
        .from('messages')
        .select('*')
        .eq('couple_id', coupleId)
        .gt('id', target.id)
        .order('id', { ascending: true })
        .limit(20),
    ])
    const before = ((beforeRes.data as Message[]) ?? []).slice().reverse()
    const after = (afterRes.data as Message[]) ?? []
    setContext({ list: [...before, ...after], targetId: target.id })
  }

  const senderName = (id: string) => (id === userId ? t('我') : partnerName)

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-warmbg">
      {/* 顶栏 */}
      <header className="flex items-center gap-2 border-b border-line bg-white/85 backdrop-blur-md px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="px-1 text-2xl text-gray-400">
          ‹
        </button>
        <h1 className="text-base font-semibold text-primary-dark">{t('查找聊天记录')}</h1>
      </header>

      {/* 筛选条件 */}
      <form onSubmit={handleSubmit} className="border-b border-line bg-white/85 backdrop-blur-md px-4 py-3">
        <div className="flex gap-2">
          <input
            className="input min-w-0 flex-1 py-2"
            type="search"
            placeholder={t('搜索消息内容…')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={imagesOnly}
          />
          <button
            type="submit"
            disabled={!hasCondition || loading}
            className="btn-primary px-4 py-2"
          >
            {t('搜索')}
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
          {/* 发送人筛选 */}
          {(['all', 'me', 'ta'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSender(s)}
              className={`rounded-full px-3 py-1 ${
                sender === s ? 'bg-soft font-medium text-primary-dark' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s === 'all' ? t('全部') : s === 'me' ? t('我发的') : t('{name}发的', { name: partnerName })}
            </button>
          ))}
          {/* 只看图片 */}
          <button
            type="button"
            onClick={() => setImagesOnly(!imagesOnly)}
            className={`rounded-full px-3 py-1 ${
              imagesOnly ? 'bg-soft font-medium text-primary-dark' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {t('🖼 只看图片')}
          </button>
          {/* 日期 */}
          <input
            className="rounded-full bg-gray-100 px-3 py-1 text-gray-500"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {date && (
            <button type="button" onClick={() => setDate('')} className="text-gray-300">
              {t('清除日期')}
            </button>
          )}
        </div>
      </form>

      {/* 结果列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && results.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-300">{t('加载中…')}</p>
        ) : !searched ? (
          <p className="py-10 text-center text-sm text-gray-300">
            {t('输入关键词、选日期或「只看图片」,然后点搜索')}
          </p>
        ) : results.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-300">{t('没有找到相关消息')}</p>
        ) : (
          <>
            <div className="divide-y divide-line overflow-hidden rounded-2xl bg-white">
              {results.map((m) => (
                <div key={m.id} className="flex items-center">
                  {/* 点击整行:直接定位到聊天中的这条消息 */}
                  <button
                    type="button"
                    onClick={() => onLocate(m.id)}
                    className="block min-w-0 flex-1 px-4 py-3 text-left active:bg-soft"
                  >
                    <p className="text-xs text-gray-400">
                      {senderName(m.sender_id)} · {fmtTime(m.created_at)}
                    </p>
                    <p className="mt-0.5 truncate text-sm">
                      {m.recalled
                        ? t('(已撤回)')
                        : m.type === 'text'
                          ? <Highlight text={m.content} q={keyword} />
                          : m.type === 'image'
                            ? t('🖼 [图片]')
                            : m.type === 'voice'
                              ? t('🎤 [语音]')
                              : m.type === 'nudge'
                                ? t('👋 [拍一拍]')
                                : t('⭐ [表情包]')}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void openContext(m)}
                    className="shrink-0 px-3 py-3 text-xs text-gray-400"
                  >
                    {t('上下文')}
                  </button>
                </div>
              ))}
            </div>
            {hasMore && (
              <button
                type="button"
                onClick={() => void runSearch(false)}
                disabled={loading}
                className="mx-auto mt-3 block rounded-full bg-white px-4 py-1.5 text-xs text-gray-400"
              >
                {loading ? t('加载中…') : t('加载更多')}
              </button>
            )}
          </>
        )}
      </div>

      {/* 上下文查看 */}
      {context && (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-warmbg">
          <header className="flex items-center gap-2 border-b border-line bg-white/85 backdrop-blur-md px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setContext(null)}
              className="px-1 text-2xl text-gray-400"
            >
              ‹
            </button>
            <h1 className="text-base font-semibold text-primary-dark">{t('消息上下文')}</h1>
          </header>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {context.list.map((m) => (
              <div
                key={m.id}
                ref={(el) => {
                  if (el && m.id === context.targetId)
                    el.scrollIntoView({ block: 'center' })
                }}
                className={`mb-2 ${
                  m.id === context.targetId ? 'rounded-2xl ring-2 ring-primary' : ''
                }`}
              >
                <MessageBubble
                  item={toItem(m)}
                  mine={m.sender_id === userId}
                  onRetry={() => undefined}
                  onPreview={(url) => setViewer(url)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 全屏看图 */}
      {viewer && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={() => setViewer(null)}
        >
          <img src={viewer} alt="查看图片" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  )
}
