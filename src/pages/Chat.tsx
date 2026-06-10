/**
 * 聊天页(M0 占位版)。
 * M2 实现:消息流、气泡分边、时间分组、输入框、Realtime 订阅、弱网重试。
 */
export default function Chat() {
  return (
    <div className="flex h-full flex-col">
      {/* 顶部标题栏:pt 留出 iPhone 刘海安全区 */}
      <header className="border-b border-rose-100 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-base font-semibold text-primary-dark">❤ 双人小屋</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
        <span className="text-4xl">💬</span>
        <p className="text-sm">聊天功能将在 M2 上线</p>
      </div>
    </div>
  )
}
