import { useState } from 'react'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { RequireAuth, RequireCouple } from './components/Guard'
import { configMissing } from './lib/supabase'
import SplashIntro from './components/SplashIntro'
import TabBar from './components/TabBar'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Pair from './pages/Pair'
import Chat from './pages/Chat'
import Ledger from './pages/Ledger'
import Us from './pages/Us'

/**
 * 主界面布局:内容区 + 底部 Tab。
 * 内容区限宽 max-w-md 并水平居中,手机上铺满、电脑上不至于太宽。
 */
function MainLayout() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      {/* 页面内容区:占满剩余高度,各页面自己管理滚动 */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <TabBar />
    </div>
  )
}

export default function App() {
  // 开场动画:每次冷启动播一次,盖在界面上方(数据在底下照常加载)
  const [introDone, setIntroDone] = useState(false)

  // 环境变量没配时给出明确提示,而不是白屏
  if (configMissing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="text-4xl">🔧</span>
        <p className="text-sm text-gray-500">
          尚未配置 Supabase 环境变量。
          <br />
          本地开发:复制 .env.example 为 .env.local 并填写;
          <br />
          线上部署:在托管平台的环境变量里设置后重新部署。
        </p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        {!introDone && <SplashIntro onDone={() => setIntroDone(true)} />}
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* 重置密码:从邮件链接进入,自带临时会话,不走常规守卫 */}
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* 以下路由要求已登录 */}
          <Route element={<RequireAuth />}>
            <Route path="/pair" element={<Pair />} />
            {/* 以下路由要求已配对 */}
            <Route element={<RequireCouple />}>
              <Route element={<MainLayout />}>
                <Route index element={<Chat />} />
                <Route path="ledger" element={<Ledger />} />
                <Route path="us" element={<Us />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
