import { useEffect, useState } from 'react'
import { getSignedUrl } from '../lib/storage'
import type { Profile } from '../types/db'

/**
 * 圆形头像:有 avatar_url 时显示图片(私有桶签名 URL),
 * 否则退回"昵称首字"占位。
 */
export default function Avatar({ profile, size = 64 }: { profile: Profile | null; size?: number }) {
  const path = profile?.avatar_url ?? null
  const [url, setUrl] = useState<string | null>(null)
  // 区分「加载中」与「加载失败」:仅用 url 是否为空无法区分,会把失败态误当成永久 loading。
  // 初值随 path:有头像的首帧就当作 loading→直接显微光,避免「首字→微光→图片」闪跳。
  const [loading, setLoading] = useState<boolean>(!!path)

  useEffect(() => {
    let cancelled = false
    if (!path) {
      setUrl(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setUrl(null)
    getSignedUrl('avatars', path).then((u) => {
      if (!cancelled) {
        setUrl(u) // 失败时 u 为 null → 下面退回昵称首字,而不是永久微光
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [path])

  const name = profile?.display_name ?? '?'
  const ring = 'ring-2 ring-white/80 shadow-sm'

  // 有头像且正在获取签名 URL:显示微光圆,避免"首字占位→图片"的闪跳。
  // 获取失败(path 有值但 url 为 null 且不在 loading)则落到最后的昵称首字占位。
  if (path && loading) {
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
