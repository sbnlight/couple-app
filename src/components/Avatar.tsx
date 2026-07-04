import { useEffect, useState } from 'react'
import { getSignedUrl } from '../lib/storage'
import type { Profile } from '../types/db'

/**
 * 圆形头像:有 avatar_url 时显示图片(私有桶签名 URL),
 * 否则退回"昵称首字"占位。
 */
export default function Avatar({ profile, size = 64 }: { profile: Profile | null; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const path = profile?.avatar_url ?? null

  useEffect(() => {
    let cancelled = false
    if (!path) {
      setUrl(null)
      return
    }
    getSignedUrl('avatars', path).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  const name = profile?.display_name ?? '?'
  const ring = 'ring-2 ring-white/80 shadow-sm'

  // 有头像但签名 URL 还没拿到:显示微光圆,避免"首字占位→图片"的闪跳
  if (path && !url) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bubble-shimmer rounded-full bg-gray-100 ${ring}`}
      />
    )
  }
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover ${ring}`}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={`flex items-center justify-center rounded-full bg-primary-light text-primary-dark ${ring}`}
    >
      {name.slice(0, 1)}
    </div>
  )
}
