import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * 小屋实时通道(Realtime Broadcast + Presence):
 * 承载"拍一拍/正在输入/想你"这类瞬时信号与"对方是否在聊天页"的在场状态。
 * 由 AuthContext 在配对完成后初始化,全局单例。
 */

export type LiveEvent = 'nudge' | 'typing' | 'miss'

let channel: RealtimeChannel | null = null
let myId = ''
const listeners = new Map<LiveEvent, Set<(payload: Record<string, unknown>) => void>>()
const presenceListeners = new Set<(partnerInChat: boolean) => void>()
let lastPartnerInChat = false

export function initLive(coupleId: string, userId: string) {
  if (channel) return
  myId = userId
  channel = supabase.channel(`live-${coupleId}`, {
    config: { presence: { key: userId }, broadcast: { self: false } },
  })
  for (const ev of ['nudge', 'typing', 'miss'] as LiveEvent[]) {
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
  channel.subscribe()
}

export function teardownLive() {
  if (channel) {
    void supabase.removeChannel(channel)
    channel = null
    lastPartnerInChat = false
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
  if (!channel) return
  void (on ? channel.track({ page: 'chat' }) : channel.untrack())
}
