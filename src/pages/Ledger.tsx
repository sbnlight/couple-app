/**
 * 记账页(M0 占位版)。
 * M3 实现:月度汇总卡片、按日分组流水、「记一笔」底部弹层、月份切换。
 */
export default function Ledger() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-base font-semibold text-primary-dark">记账</h1>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-400">
        <span className="text-4xl">📒</span>
        <p className="text-sm">记账功能将在 M3 上线</p>
      </div>
    </div>
  )
}
