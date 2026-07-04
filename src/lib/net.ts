/**
 * 弱网容错写入工具(CLAUDE.md 第 10 节硬性要求)。
 *
 * 背景:很多一次性写入(想你/打卡/记账/默契/愿望…)以前是「单次写入 + 宽 catch」,
 * 任何报错都被当成「网络不太好」。中美异地高延迟下,这既会误报,又会掩盖真正的
 * 错误(如迁移没跑导致的列缺失)。聊天发送(useMessages.attemptSend)才是范式:
 * 指数退避重试 + 幂等去重 + 区分「真·传输错误」与「真报错」。此文件把这套思路
 * 抽成通用工具,供各处写入复用。
 */

import { t } from './i18n'

/** 命中这些特征说明是「真·传输错误」(超时/断网/连接失败),值得重试、可甩锅网络 */
const TRANSIENT_RE =
  /超时|timeout|timed out|Failed to fetch|Load failed|NetworkError|network error|ERR_NETWORK|fetch failed|connection|ECONN|abort/i

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 是否为传输层可重试错误。
 * - fetchWithTimeout 超时会抛/返回 name='TimeoutError' 或 'AbortError'(supabase.ts:27)
 * - supabase-js 在 shouldThrowOnError=false 时把网络失败并进 error.message(如
 *   'TypeError: Failed to fetch'),故也按 message 匹配
 * - 5xx 视为可重试;PostgREST 的确定性错误(列缺失/RLS/约束)一律不重试
 */
export function isTransientError(err: unknown): boolean {
  if (!err) return false
  const e = err as { name?: string; message?: string; status?: number }
  if (e.name === 'TimeoutError' || e.name === 'AbortError') return true
  if (typeof e.message === 'string' && TRANSIENT_RE.test(e.message)) return true
  if (typeof e.status === 'number' && e.status >= 500) return true
  return false
}

/** Postgres 唯一约束冲突(23505):幂等写入重试后命中,通常应当作「已成功」处理 */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505'
}

/**
 * 对写入做指数退避重试:**只重试传输类错误**,真报错立即上抛(快速失败,不空等)。
 * 约定:fn 内部对 supabase 结果自行 `if (error) throw error`,把「返回 error」变成「抛错」,
 * 这样这里才能判定要不要重试。
 *
 * @example
 *   await withRetry(async () => {
 *     const { error } = await supabase.from('misses').insert({...})
 *     if (error) throw error
 *   })
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { tries = 3, baseMs = 300 }: { tries?: number; baseMs?: number } = {},
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isTransientError(err) || attempt === tries) throw err
      await sleep(baseMs * 2 ** (attempt - 1)) // 300ms → 600ms → …
    }
  }
  throw lastErr // 逻辑上到不了
}

/**
 * 把写入错误转成给用户看的文案,同时把真实错误打到 console(便于异地远程诊断)。
 * - 传输类 → 「网络不太好,请重试」(可甩锅网络)
 * - 其它(列缺失/RLS/约束等)→ 「出错了:<真实信息>」,**不再一律甩锅网络**,
 *   这样漏跑迁移之类的确定性问题能被一眼看出,而不是被「网不好」掩盖。
 */
export function friendlyWriteError(err: unknown): string {
  if (isTransientError(err)) {
    console.warn('[写入失败·传输]', err)
    return t('网络不太好,请重试')
  }
  const e = err as { code?: string; message?: string }
  const msg = (e?.code ? `${e.code} ${e.message ?? ''}` : (e?.message ?? String(err))).trim()
  console.error('[写入失败·非网络]', err)
  return t('出错了:{msg}', { msg })
}
