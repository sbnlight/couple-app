import { NavLink } from 'react-router-dom'

/** 底部导航的三个 Tab(图标先用 emoji,M4 美化时再考虑换 SVG) */
const tabs = [
  { to: '/', icon: '💬', label: '聊天' },
  { to: '/ledger', icon: '📒', label: '记账' },
  { to: '/us', icon: '👫', label: '我们' },
]

/**
 * 底部 Tab 导航。
 * pb-[env(safe-area-inset-bottom)]:给 iPhone 底部小横条留出安全区,
 * 在普通浏览器里该值为 0,不影响布局。
 */
export default function TabBar() {
  return (
    <nav className="border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
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
