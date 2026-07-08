import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * 小屋实时通道(Realtime Broadcast + Presence):
 * 承载"拍一拍/正在输入/想你"这类瞬时信号与"对方是否在聊天页"的在场状态。
 * 由 AuthContext 在配对完成后初始化,全局单例。
 */

export type LiveEvent = 'nudge' | 'typing' | 'miss' | 'touch' | 'fx'

let channel: RealtimeChannel | null = null
let currentCoupleId = ''
let myId = ''
// 期望的「在聊天页」在场意图:通道未就绪时(冷启动 Chat 的 trackInChat 可能早于 initLive)
// 先记下意图,待 subscribe 成功回调里再补做 track,避免首帧丢失的在场态整轮会话广播不出去。
let desiredInChat = false
const listeners = new Map<LiveEvent, Set<(payload: Record<string, unknown>) => void>>()
const presenceListeners = new Set<(partnerInChat: boolean) => void>()
let lastPartnerInChat = false

export function initLive(coupleId: string, userId: string) {
  // 已连到同一小屋则复用;若 coupleId 变了(如未登出直接重新配对)先拆旧通道再重建
  if (channel && currentCoupleId === coupleId) return
  if (channel) teardownLive()
  currentCoupleId = coupleId
  myId = userId
  channel = supabase.channel(`live-${coupleId}`, {
    config: { presence: { key: userId }, broadcast: { self: false } },
  })
  for (const ev of ['nudge', 'typing', 'miss', 'touch', 'fx'] as LiveEvent[]) {
    channel.on('broadcast', { event: ev }, ({ payload }) => {
      const p = (payload ?? {}) as Record<string, unknown>
      if (p.from === myId) return
      listeners.get(ev)?.forEach((cb) => cb(p))
    })
  }
  const emitPresence = () => {
    if (!channel) return
    const state = channel.presenceState<{ page?: string }>()
    lastPartnerInChat = Object.entries(state).some(
      ([key, metas]) => key !== myId && metas.some((m) => m.page === 'chat'),
    )
    presenceListeners.forEach((cb) => cb(lastPartnerInChat))
  }
  channel.on('presence', { event: 'sync' }, emitPresence)
  channel.subscribe((status) => {
    // 通道就绪后补发在场意图:修复「冷启动直落聊天页时 Chat 的 trackInChat 早于
    // initLive 执行、track 被静默丢弃」——presence 也必须在 SUBSCRIBED 之后 track 才生效。
    if (status === 'SUBSCRIBED' && channel && desiredInChat) void channel.track({ page: 'chat' })
  })
}

export function teardownLive() {
  if (channel) {
    void supabase.removeChannel(channel)
    channel = null
    currentCoupleId = ''
    lastPartnerInChat = false
    desiredInChat = false // 防御性收尾:避免残留意图在下个通道 SUBSCRIBED 时误 track
  }
}

/** 发送一个瞬时信号给对方 */
export function sendLive(ev: LiveEvent, payload: Record<string, unknown> = {}) {
  void channel?.send({ type: 'broadcast', event: ev, payload: { ...payload, from: myId } })
}

/** 订阅对方发来的信号;返回取消函数 */
export function onLive(ev: LiveEvent, cb: (p: Record<string, unknown>) => void): () => void {
  let set = listeners.get(ev)
  if (!set) {
    set = new Set()
    listeners.set(ev, set)
  }
  set.add(cb)
  return () => set.delete(cb)
}

/** 订阅"对方是否正在聊天页";立即回放当前值 */
export function onPartnerInChat(cb: (on: boolean) => void): () => void {
  presenceListeners.add(cb)
  cb(lastPartnerInChat)
  return () => presenceListeners.delete(cb)
}

/** 标记自己进入/离开聊天页(对方可见呼吸光环) */
export function trackInChat(on: boolean) {
  desiredInChat = on // 先记意图:通道未就绪时由 subscribe 回调补做
  if (!channel) return
  void (on ? channel.track({ page: 'chat' }) : channel.untrack())
}
