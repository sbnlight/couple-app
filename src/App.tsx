import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import TabBar from './components/TabBar'
import Chat from './pages/Chat'
import Ledger from './pages/Ledger'
import Us from './pages/Us'

/**
 * 主界面布局:内容区 + 底部 Tab。
 * 内容区限宽 max-w-md 并水平居中,手机上铺满、电脑上不至于太宽。
 * M1 会在外层加上 RequireAuth / RequireCouple 路由守卫(见 DESIGN.md 2)。
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
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Chat />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="us" element={<Us />} />
        </Route>
        {/* M1 将新增:/login 登录注册页、/pair 配对页 */}
      </Routes>
    </BrowserRouter>
  )
}
