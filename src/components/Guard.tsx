import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/** 全屏启动画面(会话恢复期间显示,避免闪到登录页再跳回) */
export function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <span className="animate-pulse text-5xl">❤</span>
      <p className="text-sm text-gray-400">双人小屋</p>
    </div>
  )
}

/** 路由守卫:必须已登录,否则去登录页 */
export function RequireAuth() {
  const { loading, session } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

/** 路由守卫:必须已配对(小屋两人齐),否则去配对页 */
export function RequireCouple() {
  const { loading, couple } = useAuth()
  if (loading) return <Splash />
  if (!couple || !couple.member_b) return <Navigate to="/pair" replace />
  return <Outlet />
}
