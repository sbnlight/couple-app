import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * 环境变量缺失标记。
 * 不在这里直接 throw(会导致整页白屏难排查),由 App 渲染友好的配置提示。
 */
export const configMissing = !url || !anonKey

/**
 * 给所有请求包一层 10 秒超时(弱网容错,CLAUDE.md 第 10 节硬性要求)。
 * 调用方自带的 signal 也要尊重:任一中止即中止。
 */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController()
  // Storage 上传(弱网下的语音/图片可能几百 KB)套 10s 会被误判超时→失败重试。
  // 对 storage 写请求单独放宽到 60s;普通 REST 查询仍用 10s 快速失败。
  const urlStr =
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const isStorageWrite =
    (method === 'POST' || method === 'PUT') && urlStr.includes('/storage/v1/object/')
  const timeoutMs = isStorageWrite ? 60_000 : 10_000
  const timer = setTimeout(
    () => controller.abort(new DOMException('请求超时', 'TimeoutError')),
    timeoutMs,
  )
  const callerSignal = init?.signal
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason)
    else callerSignal.addEventListener('abort', () => controller.abort(callerSignal.reason), { once: true })
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

/** Supabase 客户端单例。configMissing 时用占位值,App 会拦截不让进入业务页面 */
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder',
  { global: { fetch: fetchWithTimeout } },
)
