import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ReadStatus } from '../types/db'

/**
 * 已读回执:
 * - 上报:页面可见且收到新消息时,把"已读到的最大消息 id"写入 read_status
 * - 订阅:对方的已读位置变化由 Realtime 推过来;回前台时再兜底拉一次
 * 返回对方的已读位置(对方读到了哪条消息 id)。
 */
export function useReadStatus(coupleId: string, userId: string, latestId: number) {
  const [partnerReadId, setPartnerReadId] = useState(0)
  // 自己已成功上报过的位置,避免重复请求
  const reportedRef = useRef(0)
  // 上报在途标记,避免并发重复 upsert
  const sendingRef = useRef(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('read_status')
      .select('*')
      .eq('couple_id', coupleId)
    if (error || !data) return
    const partner = (data as ReadStatus[]).find((r) => r.user_id !== userId)
    if (partner) setPartnerReadId(partner.last_read_id)
  }, [coupleId, userId])

  useEffect(() => {
    void load()
  }, [load])

  // 上报自己的已读位置
  useEffect(() => {
    const report = () => {
      if (
        document.hidden ||
        latestId === 0 ||
        latestId <= reportedRef.current ||
        sendingRef.current
      )
        return
      const target = latestId
      sendingRef.current = true
      void supabase
        .from('read_status')
        .upsert(
          {
            couple_id: coupleId,
            user_id: userId,
            last_read_id: target,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'couple_id,user_id' },
        )
        .then(({ error }) => {
          sendingRef.current = false
          // 仅在成功后推进已上报位置;失败则保留旧值,下次可见/新消息时重试
          if (!error) reportedRef.current = target
        })
    }
    report()
    const onVisible = () => {
      if (!document.hidden) report()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [coupleId, userId, latestId])

  // 订阅对方已读位置变化;回前台兜底重拉
  useEffect(() => {
    const channel = supabase
      .channel(`read-${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'read_status', filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const row = payload.new as ReadStatus
          if (row && row.user_id !== userId) setPartnerReadId(row.last_read_id)
        },
      )
      .subscribe()
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [coupleId, userId, load])

  return partnerReadId
}
