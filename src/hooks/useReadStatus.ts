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
  // 最新的 latestId(用 ref 读取,避免闭包捕获旧值):上报在途期间若对方又连发几条,
  // upsert 完成后据此判断是否需要再追平一次,防止已读位置卡在倒数第二条。
  const latestIdRef = useRef(0)
  latestIdRef.current = latestId

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
      // 读最新值(而非闭包捕获的 latestId),这样 upsert 完成后递归调用能看到新增量
      const latest = latestIdRef.current
      if (
        document.hidden ||
        latest === 0 ||
        latest <= reportedRef.current ||
        sendingRef.current
      )
        return
      const target = latest
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
          if (!error) {
            reportedRef.current = target
            // 上报在途期间对方又连发了消息(latestId 已前进):再追平一次,
            // 否则本轮之后无新消息/不切前后台时,已读位置会卡在 target 不再更新。
            if (!document.hidden && latestIdRef.current > target) report()
          }
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
