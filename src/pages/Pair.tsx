import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Splash } from '../components/Guard'
import { t } from '../lib/i18n'

/** 把配对 RPC 抛出的错误码翻译成本地化提示 */
function translatePairError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('CODE_NOT_FOUND')) return t('邀请码不存在,请核对后再试')
  if (msg.includes('HOUSE_FULL')) return t('这个小屋已经满员啦')
  if (msg.includes('CANNOT_JOIN_SELF')) return t('这是你自己的小屋,把邀请码发给对方吧')
  if (msg.includes('ALREADY_PAIRED')) return t('你已经在一个小屋里了,刷新一下试试')
  if (msg.includes('超时') || msg.includes('abort') || msg.includes('Failed to fetch'))
    return t('网络不太好,请重试')
  return t('出错了:{msg}', { msg })
}

/**
 * 配对页。三种状态:
 * 1. 还没有小屋 → 选择「创建小屋」或「输入邀请码加入」
 * 2. 已创建小屋等待对方 → 大字展示邀请码 + 轮询配对状态
 * 3. 配对完成 → 自动进入主界面
 */
export default function Pair() {
  const { loading, couple, refresh, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const waiting = !!couple && !couple.member_b
  const paired = !!couple?.member_b

  // 等待对方加入期间:每 5 秒轮询一次;回到前台立刻查一次
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => {
      void refresh()
    }, 5000)
    const onVisible = () => {
      if (!document.hidden) void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [waiting, refresh])

  if (loading) return <Splash />
  if (paired) return <Navigate to="/" replace />

  const handleCreate = async () => {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.rpc('create_couple')
      if (error) throw error
      await refresh() // 拉到新小屋后自动切到"等待对方"视图
    } catch (err) {
      setError(translatePairError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || code.trim().length < 6) return
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.rpc('join_couple_by_code', { code: code.trim() })
      if (error) throw error
      await refresh() // 配对成功,上面的 <Navigate> 自动进入主界面
    } catch (err) {
      setError(translatePairError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!couple) return
    try {
      await navigator.clipboard.writeText(couple.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 个别浏览器禁用剪贴板 API,长按邀请码也能手动复制
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center overflow-y-auto px-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      {waiting && couple ? (
        /* ---- 已建小屋,等待对方加入 ---- */
        <div className="text-center">
          <div className="text-5xl">🏠</div>
          <h1 className="mt-3 text-xl font-bold text-primary-dark">{t('小屋已建好')}</h1>
          <p className="mt-1 text-sm text-gray-400">{t('把邀请码发给 TA,等 TA 输入后就配对成功')}</p>

          <button
            type="button"
            onClick={handleCopy}
            className="mt-8 w-full rounded-2xl border-2 border-dashed border-primary bg-white py-6"
          >
            <span className="font-mono text-4xl font-bold tracking-[0.3em] text-primary-dark">
              {couple.invite_code}
            </span>
            <span className="mt-2 block text-xs text-gray-400">
              {copied ? t('已复制 ✓') : t('点击复制')}
            </span>
          </button>

          <p className="mt-6 animate-pulse text-sm text-gray-400">{t('正在等待 TA 加入…')}</p>
        </div>
      ) : (
        /* ---- 还没有小屋:创建 或 凭码加入 ---- */
        <div>
          <div className="mb-8 text-center">
            <div className="text-5xl">🏠</div>
            <h1 className="mt-3 text-xl font-bold text-primary-dark">{t('建立我们的小屋')}</h1>
            <p className="mt-1 text-sm text-gray-400">{t('一个人创建小屋,另一个人凭邀请码加入')}</p>
          </div>

          <button type="button" onClick={handleCreate} disabled={busy} className="btn-primary w-full">
            {busy ? t('请稍候…') : t('创建小屋,获取邀请码')}
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-gray-300">
            <div className="h-px flex-1 bg-line" />
            {t('或者')}
            <div className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              className="input text-center font-mono text-xl tracking-[0.3em]"
              type="text"
              placeholder={t('输入 6 位邀请码')}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              value={code}
              // 先去空白、大写,最后才截断到 6 位:粘贴带空格的码不会因 maxLength 先截断而丢字符
              onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 6))}
            />
            <button
              type="submit"
              disabled={busy || code.trim().length < 6}
              className="btn-primary"
            >
              {t('加入 TA 的小屋')}
            </button>
          </form>
        </div>
      )}

      {error && <p className="mt-4 text-center text-sm text-red-500">{error}</p>}

      <button
        type="button"
        className="mt-10 text-center text-sm text-gray-400 underline"
        onClick={() => void signOut()}
      >
        {t('退出登录,换个账号')}
      </button>
    </div>
  )
}
