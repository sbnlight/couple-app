import { NavLink, useLocation } from 'react-router-dom'

/** 底部导航的三个 Tab(图标先用 emoji,M4 美化时再考虑换 SVG) */
const tabs = [
  { to: '/', icon: '💬', label: '聊天' },
  { to: '/ledger', icon: '📒', label: '记账' },
  { to: '/us', icon: '👫', label: '我们' },
]

/**
 * 底部 Tab 导航:毛玻璃质感 + 顶部滑动指示条。
 * pb-[env(safe-area-inset-bottom)]:给 iPhone 底部小横条留出安全区。
 */
export default function TabBar() {
  const { pathname } = useLocation()
  const activeIdx = pathname.startsWith('/ledger') ? 1 : pathname.startsWith('/us') ? 2 : 0

  return (
    <nav className="relative border-t border-line bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      {/* 当前 Tab 指示条(随切换平滑滑动) */}
      <span
        className="absolute top-0 h-0.5 w-10 -translate-x-1/2 rounded-full bg-primary transition-[left] duration-300"
        style={{ left: `${activeIdx * 33.333 + 16.667}%` }}
      />
      <div className="flex">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            // 聊天页是 index 路由,需要 end 精确匹配,否则所有路径都算它激活
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                isActive ? 'text-primary-dark font-medium' : 'text-gray-400'
              }`
            }
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
