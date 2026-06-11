import { useAuth } from '../contexts/AuthContext'

/** 圆形头像占位:取昵称第一个字(头像上传功能后续里程碑再加) */
function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-2xl text-primary-dark">
      {name.slice(0, 1)}
    </div>
  )
}

/** 「我们」设置页:双方信息、配对状态、退出登录 */
export default function Us() {
  const { profile, partner, couple, signOut } = useAuth()

  // 小屋建立至今的天数(后续可换成正式的纪念日功能)
  const days = couple
    ? Math.floor((Date.now() - new Date(couple.created_at).getTime()) / 86_400_000) + 1
    : 0

  const handleSignOut = () => {
    if (window.confirm('确定要退出登录吗?')) void signOut()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-rose-100 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-base font-semibold text-primary-dark">我们</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {/* 双方头像与昵称 */}
        <div className="flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Avatar name={profile?.display_name ?? '我'} />
            <span className="text-sm">{profile?.display_name ?? '我'}</span>
          </div>
          <span className="text-2xl text-primary">❤</span>
          <div className="flex flex-col items-center gap-2">
            <Avatar name={partner?.display_name ?? '?'} />
            <span className="text-sm">{partner?.display_name ?? '等待加入'}</span>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          小屋已建立 <span className="font-semibold text-primary-dark">{days}</span> 天
        </p>

        {/* 功能列表:未来的纪念日/打卡/愿望清单等入口都加在这里 */}
        <div className="mt-10 overflow-hidden rounded-2xl bg-white">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full px-5 py-4 text-left text-red-500 active:bg-rose-50"
          >
            🚪 退出登录
          </button>
        </div>
      </div>
    </div>
  )
}
