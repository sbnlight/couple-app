/**
 * 「我们」设置页(M0 占位版)。
 * M1 起逐步加入:双方头像昵称、配对状态、退出登录;未来新功能入口也放这里。
 */
export default function Us() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-rose-100 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-base font-semibold text-primary-dark">我们</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
        <span className="text-4xl">👫</span>
        <p className="text-sm">登录与配对将在 M1 上线</p>
      </div>
    </div>
  )
}
