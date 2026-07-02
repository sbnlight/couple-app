import { supabase } from './supabase'

// 签名 URL 缓存:同一个文件 55 分钟内不重复请求(签名有效期 1 小时)
const cache = new Map<string, { url: string; expiresAt: number }>()
// 缓存条目上限:超过后按插入顺序淘汰最旧的,避免长期使用(大量图片)无界增长
const CACHE_MAX = 300

/** 获取私有桶文件的签名 URL;失败返回 null(界面退回占位显示) */
export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  const key = `${bucket}/${path}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.url

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (error || !data) return null
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { url: data.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 })
  return data.signedUrl
}

/** 使某个文件的签名 URL 缓存失效(如撤回图片/语音后,不让已缓存的 URL 继续可用) */
export function clearSignedUrl(bucket: string, path: string) {
  cache.delete(`${bucket}/${path}`)
}
