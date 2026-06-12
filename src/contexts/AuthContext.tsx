import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { deviceTimezone } from '../lib/time'
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

    // 设备时区变了(出差/旅行)就自动同步到个人资料,对方看到的"当地时间"随之更新
    const tz = deviceTimezone()
    if (p && tz && p.timezone !== tz) {
      p.timezone = tz
      void supabase.from('profiles').update({ timezone: tz }).eq('id', uid)
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

  // 回到前台时刷新一次:能及时看到对方改的昵称/头像/小屋名
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden && userId) void loadData(userId)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId, loadData])

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
