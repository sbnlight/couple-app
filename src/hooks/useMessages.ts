import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage, extFromType } from '../lib/image'
import { deletePendingMedia, getPendingMedia, putPendingMedia } from '../lib/pendingStore'
import { clearSignedUrl } from '../lib/storage'
import type { Message, MessageType } from '../types/db'

const PAGE_SIZE = 50

/**
 * 聊天列表里的一条(服务端消息与本地待发消息的统一形态)。
 * status:sent=服务端已确认 / sending=发送中 / failed=失败等待手动重试
 */
export interface ChatItem {
  key: string
  id?: number
  type: MessageType
  /** 文本内容,或图片/表情包在 Storage 中的路径 */
  content: string
  senderId: string
  createdAt: string
  status: 'sent' | 'sending' | 'failed'
  /** 待发送图片的本地预览地址(object URL) */
  previewUrl?: string
  /** 已撤回 */
  recalled?: boolean
  /** 引用回复的预览文本 */
  replyPreview?: string | null
  /** 引用回复指向的消息 id(用于判断被引用消息是否已被撤回) */
  replyTo?: number | null
  /** 发送时冻结的气泡/字体 id(为空则回退按发送者当前渲染) */
  bubbleId?: string | null
  bubbleFont?: string | null
}

/** 本地待发队列里的一条 */
interface PendingMsg {
  localId: string
  type: MessageType
  /** 文本/表情包路径;图片与语音为上传成功后的内容(未上传时为空串) */
  content: string
  createdAt: string
  status: 'sending' | 'failed'
  blob?: Blob
  previewUrl?: string
  /** 语音时长(秒)与文件信息 */
  voiceDur?: number
  voiceExt?: string
  voiceMime?: string
  /** 引用回复 */
  replyTo?: number
  replyPreview?: string
  /** 发送时冻结的气泡/字体 id */
  bubbleId?: string
  bubbleFont?: string
}

const pendingKey = (coupleId: string) => `pending-msgs-${coupleId}`

/**
 * 把待发的文本/表情包消息持久化到本地,杀掉 App 重开也不丢
 * (图片的 Blob 无法序列化,不做持久化;恢复时一律标记为 failed 等待手动重试)
 */
function savePending(coupleId: string, list: PendingMsg[]) {
  const texts = list
    .filter((p) => p.type !== 'image' && p.type !== 'voice')
    .map(({ localId, type, content, createdAt, replyTo, replyPreview, bubbleId, bubbleFont }) => ({
      localId,
      type,
      content,
      createdAt,
      replyTo,
      replyPreview,
      bubbleId,
      bubbleFont,
    }))
  try {
    localStorage.setItem(pendingKey(coupleId), JSON.stringify(texts))
  } catch {
    // 存储满等异常不影响发送流程
  }
}

function loadPending(coupleId: string): PendingMsg[] {
  try {
    const raw = localStorage.getItem(pendingKey(coupleId))
    if (!raw) return []
    const arr = JSON.parse(raw) as Omit<PendingMsg, 'status'>[]
    return arr.map((p) => ({ ...p, status: 'failed' as const }))
  } catch {
    return []
  }
}

/**
 * 聊天数据流核心 Hook(弱网容错设计见 DESIGN.md 4.2):
 * - 服务端数据库是唯一事实来源,Realtime 推送只是加速通知
 * - 重连/回前台/网络恢复时按本地最大 id 增量补拉
 * - 发送走乐观更新 + 自动指数退避重试;重试前先按 client_id 查重,绝不产生重复消息
 */
export function useMessages(
  coupleId: string,
  userId: string,
  /** 发送者"当前气泡/字体 id"的 ref(由 Chat 每次渲染更新);发送时冻结进消息 */
  bubbleRef?: { current: { id?: string; font?: string } },
) {
  const [serverMsgs, setServerMsgs] = useState<Message[]>([])
  const [pending, setPending] = useState<PendingMsg[]>(() => loadPending(coupleId))
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [initialError, setInitialError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  // live=跟随最新;history=从搜索定位进入的历史浏览(此时暂停实时合并)
  const [mode, setMode] = useState<'live' | 'history'>('live')
  const [hasNewer, setHasNewer] = useState(false)
  const modeRef = useRef<'live' | 'history'>('live')

  const switchMode = (m: 'live' | 'history') => {
    modeRef.current = m
    setMode(m)
  }

  // ref 镜像,供回调里读取最新值,避免闭包过期
  const serverRef = useRef<Message[]>([])
  const pendingRef = useRef<PendingMsg[]>(pending)
  const maxIdRef = useRef(0)
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  // 恢复上次未发出的图片/语音(存在 IndexedDB):重开后作为 failed 可手动重试,
  // 不再静默消失。若其实已发送成功(client_id 已落库),重试时会被去重并清理。
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const media = await getPendingMedia(coupleId)
      if (cancelled || media.length === 0) return
      setPending((prev) => {
        const existing = new Set(prev.map((p) => p.localId))
        const restored: PendingMsg[] = media
          .filter((m) => !existing.has(m.localId))
          .map((m) => ({
            localId: m.localId,
            type: m.type,
            content: '',
            createdAt: m.createdAt,
            status: 'failed' as const,
            blob: m.blob,
            previewUrl: m.type === 'image' ? URL.createObjectURL(m.blob) : undefined,
            voiceDur: m.voiceDur,
            voiceExt: m.voiceExt,
            voiceMime: m.voiceMime,
            replyTo: m.replyTo,
            replyPreview: m.replyPreview,
          }))
        return restored.length > 0 ? [...prev, ...restored] : prev
      })
    })()
    return () => {
      cancelled = true
    }
  }, [coupleId])

  /** 合并服务端消息:按 id 去重排序;命中待发队列 client_id 的一并移除 */
  const mergeServer = useCallback(
    (rows: Message[]) => {
      if (rows.length === 0) return
      setServerMsgs((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]))
        for (const r of rows) map.set(r.id, r)
        const merged = [...map.values()].sort((a, b) => a.id - b.id)
        serverRef.current = merged
        maxIdRef.current = merged.length > 0 ? merged[merged.length - 1].id : 0
        return merged
      })
      const clientIds = new Set(rows.map((r) => r.client_id).filter(Boolean))
      if (clientIds.size > 0) {
        setPending((prev) => {
          const removed = prev.filter((p) => clientIds.has(p.localId))
          const next = prev.filter((p) => !clientIds.has(p.localId))
          if (next.length !== prev.length) {
            savePending(coupleId, next)
            for (const p of removed) {
              // 图片/语音的 Blob 存在 IndexedDB,确认落库后一并清除,避免残留
              if (p.type === 'image' || p.type === 'voice') void deletePendingMedia(p.localId)
              // 回收本地预览 object URL,避免长会话内存泄漏
              if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
            }
          }
          return next
        })
      }
    },
    [coupleId],
  )

  /** 首次加载:最近 50 条 */
  const loadInitial = useCallback(async () => {
    setLoadingInitial(true)
    setInitialError(false)
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('couple_id', coupleId)
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)
    if (error) {
      setInitialError(true)
      setLoadingInitial(false)
      return
    }
    const rows = (data as Message[]).slice().reverse()
    mergeServer(rows)
    setHasMore((data as Message[]).length === PAGE_SIZE)
    setLoadingInitial(false)
  }, [coupleId, mergeServer])

  /** 向上翻页:加载更早的消息 */
  const loadOlder = useCallback(async () => {
    const oldest = serverRef.current[0]?.id
    if (!oldest || loadingOlder) return
    setLoadingOlder(true)
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('couple_id', coupleId)
      .lt('id', oldest)
      .order('id', { ascending: false })
      .limit(PAGE_SIZE)
    if (!error && data) {
      mergeServer((data as Message[]).slice().reverse())
      setHasMore((data as Message[]).length === PAGE_SIZE)
    }
    setLoadingOlder(false)
  }, [coupleId, mergeServer, loadingOlder])

  /** 已加载消息的就地更新(撤回等场景) */
  const mergeUpdate = useCallback((row: Message) => {
    setServerMsgs((prev) => {
      if (!prev.some((m) => m.id === row.id)) return prev
      const next = prev.map((m) => (m.id === row.id ? row : m))
      serverRef.current = next
      return next
    })
  }, [])

  /** 增量补拉:取本地最大 id 之后的所有消息(Realtime 丢推的兜底) */
  const catchUp = useCallback(async () => {
    if (modeRef.current !== 'live') return
    // 循环续拉,直到取回不足一页 —— 离线期间错过 >200 条也能一次补齐,
    // 不会只补前 200 条就停(要等下次可见/上线事件)
    const LIMIT = 200
    let since = maxIdRef.current
    if (since === 0) return
    for (let i = 0; i < 50; i++) {
      if (modeRef.current !== 'live') return
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('couple_id', coupleId)
        .gt('id', since)
        .order('id', { ascending: true })
        .limit(LIMIT)
      if (error || !data || data.length === 0) return
      const rows = data as Message[]
      mergeServer(rows)
      since = rows[rows.length - 1].id // 用返回数据推进,不依赖 setState 的异步更新
      if (rows.length < LIMIT) return
    }
  }, [coupleId, mergeServer])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  // Realtime 订阅新消息;每次(重)连成功都补拉一次错过的
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => {
          // 历史浏览中不并入新消息,只点亮"有更新"的提示
          if (modeRef.current !== 'live') {
            setHasNewer(true)
            return
          }
          mergeServer([payload.new as Message])
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => mergeUpdate(payload.new as Message),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void catchUp()
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [coupleId, mergeServer, catchUp])

  // 回到前台 / 网络恢复时补拉
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void catchUp()
    }
    const onOnline = () => void catchUp()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [catchUp])

  /**
   * 投递一条待发消息:自动重试 3 次(0s/1s/2s 指数退避)。
   * 每次尝试都先按 client_id 查重——上次"超时但实际已写入"时直接复用服务端行。
   */
  const attemptSend = useCallback(
    async (msg: PendingMsg) => {
      setPending((prev) =>
        prev.map((x) => (x.localId === msg.localId ? { ...x, status: 'sending' as const } : x)),
      )
      let content = msg.content
      const delays = [0, 1000, 2000]
      for (const delay of delays) {
        if (delay > 0) await new Promise((r) => setTimeout(r, delay))
        try {
          // 图片/语音:先上传文件(重试时已传过则跳过)
          if ((msg.type === 'image' || msg.type === 'voice') && content === '') {
            if (!msg.blob) throw Object.assign(new Error('媒体数据已丢失'), { fatal: true })
            // 图片按真实类型选扩展名/内容类型(保留 GIF 动图、PNG 透明)
            const ext =
              msg.type === 'voice' ? (msg.voiceExt ?? 'm4a') : extFromType(msg.blob.type)
            const contentType =
              msg.type === 'voice' ? (msg.voiceMime ?? 'audio/mp4') : msg.blob.type || 'image/jpeg'
            const path = `${coupleId}/${msg.localId}.${ext}`
            const { error: upErr } = await supabase.storage
              .from('chat-images')
              .upload(path, msg.blob, {
                contentType,
                upsert: true,
              })
            if (upErr) throw upErr
            // 语音的 content 是 JSON:路径 + 时长(秒)
            content =
              msg.type === 'voice'
                ? JSON.stringify({ p: path, d: msg.voiceDur ?? 0 })
                : path
            const done = content
            setPending((prev) =>
              prev.map((x) => (x.localId === msg.localId ? { ...x, content: done } : x)),
            )
          }

          // 查重:client_id 命中说明早已落库
          const { data: existing } = await supabase
            .from('messages')
            .select('*')
            .eq('client_id', msg.localId)
            .maybeSingle()
          let row = existing as Message | null
          if (!row) {
            const { data, error } = await supabase
              .from('messages')
              .insert({
                couple_id: coupleId,
                sender_id: userId,
                type: msg.type,
                content,
                client_id: msg.localId,
                reply_to: msg.replyTo ?? null,
                reply_preview: msg.replyPreview ?? null,
                bubble_id: msg.bubbleId ?? null,
                bubble_font: msg.bubbleFont ?? null,
              })
              .select()
              .single()
            if (error) throw error
            row = data as Message
          }
          mergeServer([row]) // 同时会把这条从待发队列移除
          return
        } catch (err) {
          if ((err as { fatal?: boolean }).fatal) break
        }
      }
      // 自动重试均失败 → 标记失败,等用户点击重试(绝不静默丢弃)
      setPending((prev) => {
        const next = prev.map((x) =>
          x.localId === msg.localId ? { ...x, status: 'failed' as const } : x,
        )
        savePending(coupleId, next)
        return next
      })
    },
    [coupleId, userId, mergeServer],
  )

  /** 发送文本消息(乐观更新:立即上屏,后台投递);可带引用回复 */
  const sendText = useCallback(
    (text: string, reply?: { id: number; preview: string }) => {
      const t = text.trim()
      if (!t) return
      const p: PendingMsg = {
        localId: crypto.randomUUID(),
        type: 'text',
        content: t,
        createdAt: new Date().toISOString(),
        status: 'sending',
        replyTo: reply?.id,
        replyPreview: reply?.preview,
        bubbleId: bubbleRef?.current.id,
        bubbleFont: bubbleRef?.current.font,
      }
      setPending((prev) => {
        const next = [...prev, p]
        savePending(coupleId, next)
        return next
      })
      void attemptSend(p)
    },
    [coupleId, attemptSend],
  )

  /** 发送图片消息:压缩 → 占位上屏 → 上传 + 落库 */
  const sendImage = useCallback(
    async (file: File) => {
      const blob = await compressImage(file, 1280, 0.8) // 失败会抛错,由页面提示
      const p: PendingMsg = {
        localId: crypto.randomUUID(),
        type: 'image',
        content: '',
        createdAt: new Date().toISOString(),
        status: 'sending',
        blob,
        previewUrl: URL.createObjectURL(blob),
        bubbleId: bubbleRef?.current.id,
        bubbleFont: bubbleRef?.current.font,
      }
      setPending((prev) => [...prev, p])
      // 落 IndexedDB:App 被杀/刷新后仍可恢复重发,不静默丢失
      void putPendingMedia({
        localId: p.localId,
        coupleId,
        type: 'image',
        createdAt: p.createdAt,
        blob,
        replyTo: p.replyTo,
        replyPreview: p.replyPreview,
      })
      void attemptSend(p)
    },
    [coupleId, attemptSend],
  )

  /** 发送语音消息:blob 上传后 content 存 {p:路径, d:秒数} */
  const sendVoice = useCallback(
    (blob: Blob, durationSec: number, ext: string, mime: string) => {
      const p: PendingMsg = {
        localId: crypto.randomUUID(),
        type: 'voice',
        content: '',
        createdAt: new Date().toISOString(),
        status: 'sending',
        blob,
        voiceDur: Math.max(1, Math.round(durationSec)),
        voiceExt: ext,
        voiceMime: mime,
        bubbleId: bubbleRef?.current.id,
        bubbleFont: bubbleRef?.current.font,
      }
      setPending((prev) => [...prev, p])
      void putPendingMedia({
        localId: p.localId,
        coupleId,
        type: 'voice',
        createdAt: p.createdAt,
        blob,
        voiceDur: p.voiceDur,
        voiceExt: p.voiceExt,
        voiceMime: p.voiceMime,
      })
      void attemptSend(p)
    },
    [coupleId, attemptSend],
  )

  /** 拍一拍:一条 nudge 类型的消息(聊天里显示居中提示) */
  const sendNudge = useCallback(() => {
    const p: PendingMsg = {
      localId: crypto.randomUUID(),
      type: 'nudge',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'sending',
    }
    setPending((prev) => [...prev, p])
    void attemptSend(p)
  }, [attemptSend])

  /** 发送表情包消息(图片已在 stickers 桶里,只需写一条消息记录) */
  const sendSticker = useCallback(
    (path: string) => {
      const p: PendingMsg = {
        localId: crypto.randomUUID(),
        type: 'sticker',
        content: path,
        createdAt: new Date().toISOString(),
        status: 'sending',
      }
      setPending((prev) => {
        const next = [...prev, p]
        savePending(coupleId, next)
        return next
      })
      void attemptSend(p)
    },
    [coupleId, attemptSend],
  )

  /** 手动重试一条失败的消息 */
  const retrySend = useCallback(
    (localId: string) => {
      const p = pendingRef.current.find((x) => x.localId === localId)
      if (p && p.status === 'failed') void attemptSend(p)
    },
    [attemptSend],
  )

  /** 撤回自己的消息(服务端校验:仅本人、2 分钟内) */
  const recallMessage = useCallback(
    async (id: number) => {
      const row = serverRef.current.find((m) => m.id === id)
      // 撤回前先算出要清理的一次性文件:图片=路径本身,语音=JSON 里的 p。
      // 表情包在 stickers 共享库、可复用,不删文件。
      let filePath: string | null = null
      if (row?.type === 'image') filePath = row.content || null
      else if (row?.type === 'voice') {
        try {
          filePath = (JSON.parse(row.content) as { p?: string }).p ?? null
        } catch {
          filePath = null
        }
      }
      const { error } = await supabase.rpc('recall_message', { mid: id })
      if (error) throw error
      if (row) mergeUpdate({ ...row, recalled: true, content: '' })
      // 删除 Storage 原文件并清签名 URL 缓存,避免已拿到 URL 的一方还能访问
      if (filePath) {
        void supabase.storage.from('chat-images').remove([filePath])
        clearSignedUrl('chat-images', filePath)
      }
    },
    [mergeUpdate],
  )

  /** 定位到某条历史消息:加载它前后各 25 条,进入历史浏览模式 */
  const jumpTo = useCallback(
    async (targetId: number) => {
      const [beforeRes, afterRes] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .eq('couple_id', coupleId)
          .lte('id', targetId)
          .order('id', { ascending: false })
          .limit(25),
        supabase
          .from('messages')
          .select('*')
          .eq('couple_id', coupleId)
          .gt('id', targetId)
          .order('id', { ascending: true })
          .limit(25),
      ])
      if (beforeRes.error || afterRes.error) return false
      const before = (beforeRes.data as Message[]).slice().reverse()
      const after = (afterRes.data as Message[]) ?? []
      const win = [...before, ...after]
      serverRef.current = win
      maxIdRef.current = win.length > 0 ? win[win.length - 1].id : 0
      setServerMsgs(win)
      setHasMore(before.length === 25)
      const newerFull = after.length === 25
      setHasNewer(newerFull)
      switchMode(newerFull ? 'history' : 'live')
      return true
    },
    [coupleId],
  )

  /** 历史浏览中向下翻页(更新的消息);翻到头自动回到 live */
  const loadNewer = useCallback(async () => {
    const since = maxIdRef.current
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('couple_id', coupleId)
      .gt('id', since)
      .order('id', { ascending: true })
      .limit(50)
    if (error || !data) return
    mergeServer(data as Message[])
    if ((data as Message[]).length < 50) {
      setHasNewer(false)
      switchMode('live')
    }
  }, [coupleId, mergeServer])

  /** 一键回到最新对话 */
  const backToLatest = useCallback(async () => {
    switchMode('live')
    setHasNewer(false)
    serverRef.current = []
    maxIdRef.current = 0
    setServerMsgs([])
    await loadInitial()
  }, [loadInitial])

  // 输出统一形态:服务端消息在前,本地待发(更新)在后
  const items: ChatItem[] = [
    ...serverMsgs.map((m) => ({
      key: `s-${m.id}`,
      id: m.id,
      type: m.type,
      content: m.content,
      senderId: m.sender_id,
      createdAt: m.created_at,
      status: 'sent' as const,
      recalled: m.recalled,
      replyPreview: m.reply_preview,
      replyTo: m.reply_to,
      bubbleId: m.bubble_id,
      bubbleFont: m.bubble_font,
    })),
    ...pending.map((p) => ({
      key: p.localId,
      type: p.type,
      content: p.content,
      senderId: userId,
      createdAt: p.createdAt,
      status: p.status,
      previewUrl: p.previewUrl,
      replyPreview: p.replyPreview,
      replyTo: p.replyTo,
      bubbleId: p.bubbleId,
      bubbleFont: p.bubbleFont,
    })),
  ]

  return {
    items,
    loadingInitial,
    initialError,
    reload: loadInitial,
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
  }
}
