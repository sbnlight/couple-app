import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/net'
import { deviceTimezone, LIVE_REFRESH_MS } from '../lib/time'
import { reverseGeocode } from '../lib/weather'
import { getAutoLocation } from '../lib/prefs'
import { initLive, teardownLive } from '../lib/live'
import type { Couple, Profile } from '../types/db'

/**
 * 全局认证与配对状态。
 * 登录/注册直接在 Login 页调用 supabase.auth,这里只负责:
 * 恢复会话、监听会话变化、拉取本人档案/小屋/对方档案。
 */
interface AuthContextValue {
  /** 初始加载中(会话恢复 + 首次数据拉取),期间显示启动画面 */
  loading: boolean
  session: Session | null
  profile: Profile | null
  couple: Couple | null
  /** 对方的档案,配对完成后才有 */
  partner: Profile | null
  /** 重新拉取 profile / couple / partner(配对页轮询等场景使用) */
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionLoading, setSessionLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [couple, setCouple] = useState<Couple | null>(null)
  const [partner, setPartner] = useState<Profile | null>(null)

  // 恢复本地会话 + 监听登录状态变化
  // 注意:onAuthStateChange 回调里不能直接调其他 supabase 方法(官方文档警告
  // 可能死锁),所以这里只 setSession,数据拉取放在下面按 userId 触发的 effect 里
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  // 拉取本人档案 + 所在小屋 + 对方档案
  const loadData = useCallback(async (uid: string) => {
    const [profileRes, coupleRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase
        .from('couples')
        .select('*')
        .or(`member_a.eq.${uid},member_b.eq.${uid}`)
        .maybeSingle(),
    ])
    const p = (profileRes.data as Profile | null) ?? null
    const c = (coupleRes.data as Couple | null) ?? null

    // 设备时区变了(出差/旅行)就自动同步到个人资料,对方看到的"当地时间"随之更新。
    // 弱网重试(iOS/国内易丢包):以前是 fire-and-forget 单发,一旦失败对方永远看不到你的
    // 当地时间;这里改为退避重试,失败也不阻塞加载,下次开 App / 回前台还会再试。
    const tz = deviceTimezone()
    if (p && tz && p.timezone !== tz) {
      p.timezone = tz
      void withRetry(async () => {
        const { error } = await supabase.from('profiles').update({ timezone: tz }).eq('id', uid)
        if (error) throw error
      }).catch(() => {})
    }

    setProfile(p)
    setCouple(c)

    if (c && c.member_b) {
      const partnerId = c.member_a === uid ? c.member_b : c.member_a
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', partnerId)
        .maybeSingle()
      setPartner((data as Profile | null) ?? null)
    } else {
      setPartner(null)
    }
  }, [])

  // 登录用户变化时重新拉数据;登出时清空
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setCouple(null)
      setPartner(null)
      return
    }
    setDataLoading(true)
    loadData(userId).finally(() => setDataLoading(false))
  }, [userId, loadData])

  const refresh = useCallback(async () => {
    if (userId) await loadData(userId)
  }, [userId, loadData])

  // 配对完成后建立小屋实时通道(拍一拍/输入中/想你/在场);登出时拆除
  useEffect(() => {
    if (couple?.member_b && userId) initLive(couple.id, userId)
  }, [couple, userId])
  useEffect(() => {
    if (!userId) teardownLive()
  }, [userId])

  // 回到前台时刷新一次:能及时看到对方改的昵称/头像/小屋名
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && userId) void loadData(userId)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, loadData])

  // 定时刷新「对方档案」(位置/城市/坐标/时区/心情):让顶栏天气、双城卡片的
  // 当地时间与「相距 N 公里」在对方更新位置后约 1 分钟内自动同步。
  // 刻意只重拉对方这一行、且只在前台刷:
  //  · 不动 couple / 自己,避免每分钟重建实时通道(initLive 依赖 couple 对象身份);
  //  · document.hidden(退到后台)时跳过,省电省流量。
  const partnerId =
    couple?.member_b && userId
      ? couple.member_a === userId
        ? couple.member_b
        : couple.member_a
      : null
  useEffect(() => {
    if (!partnerId) return
    const pull = async () => {
      if (document.hidden) return
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', partnerId)
        .maybeSingle()
      if (data) setPartner(data as Profile)
    }
    const timer = setInterval(() => {
      void pull()
    }, LIVE_REFRESH_MS)
    return () => clearInterval(timer)
  }, [partnerId])

  // 自动更新「我的位置」:开关默认关(在「我的位置」面板里开)。开启后——授权一次,
  // 之后每次打开 / 回到前台,静默用 GPS 把我的精确城市/坐标写回 profiles,不用手动。
  // 仅前台 + 开关开 + 授权可用时进行;失败/被拒静默回退手动;最多每 3 分钟一次。
  const lastLocRef = useRef(0)
  useEffect(() => {
    if (!userId || !('geolocation' in navigator)) return
    let cancelled = false
    const run = () => {
      if (document.hidden || !getAutoLocation()) return
      if (Date.now() - lastLocRef.current < 3 * 60 * 1000) return
      lastLocRef.current = Date.now()
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return
          const { latitude, longitude } = pos.coords
          const name = await reverseGeocode(latitude, longitude)
          await withRetry(async () => {
            const patch: { city?: string; lat: number; lng: number } = {
              lat: latitude,
              lng: longitude,
            }
            if (name) patch.city = name
            const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
            if (error) throw error
          }).catch(() => {})
          if (cancelled) return
          // 只重拉自己这一行(顶栏/双城卡片里的「我」随之更新),不动 couple,避免重建实时通道
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
          if (data && !cancelled) setProfile(data as Profile)
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
      )
    }
    run()
    const onVisible = () => {
      if (!document.hidden) run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  // 首次进入:会话恢复中,或已有会话但档案还没拉到 → 视为加载中
  // (profile 已存在后的 refresh 不触发启动画面,避免轮询时闪屏)
  const loading = sessionLoading || (!!session && dataLoading && !profile)

  return (
    <AuthContext.Provider
      value={{ loading, session, profile, couple, partner, refresh, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 <AuthProvider> 内使用')
  return ctx
}
