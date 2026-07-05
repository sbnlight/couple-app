import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Splash } from '../components/Guard'
import { t } from '../lib/i18n'

/** 把 Supabase 的英文报错翻译成本地化提示 */
function translateAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Invalid login credentials')) return t('邮箱或密码不正确')
  if (msg.toLowerCase().includes('already registered')) return t('该邮箱已注册,请直接登录')
  if (msg.includes('at least 6 characters')) return t('密码至少需要 6 位')
  if (msg.includes('valid email') || msg.includes('invalid format')) return t('请输入有效的邮箱地址')
  if (msg.includes('rate limit') || msg.includes('security purposes')) return t('操作太频繁,请稍等一会再试')
  if (msg.includes('超时') || msg.includes('abort')) return t('网络超时,请检查网络后重试')
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return t('连不上服务器,请检查网络')
  return t('出错了:{msg}', { msg })
}

type Mode = 'login' | 'signup' | 'forgot'

/** 登录 / 注册 / 忘记密码(同页切换) */
export default function Login() {
  const { loading, session } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // 重置邮件发送后的冷却秒数:免费版邮件服务每小时限发几封,防止用户连点
  const [cooldown, setCooldown] = useState(0)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    if (cooldown === 0) return
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (loading) return <Splash />
  // 已登录则交给守卫决定:去配对页还是主界面
  if (session) return <Navigate to="/" replace />

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
    setNotice('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    setNotice('')
    if (mode === 'signup' && !displayName.trim()) {
      setError(t('给自己起个昵称吧'))
      return
    }
    if (mode === 'signup' && password !== password2) {
      setError(t('两次输入的密码不一致,请检查'))
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'forgot') {
        // 发送重置密码邮件;链接会跳回本应用的 /reset-password 页
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        setNotice(t('重置邮件已发送,请到邮箱点击链接设置新密码。邮件可能要等一两分钟,也看看垃圾邮件箱'))
        setCooldown(60)
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // display_name 会被数据库触发器写进 profiles 表
          options: { data: { display_name: displayName.trim() } },
        })
        if (error) throw error
        // 若 Supabase 后台没有关闭邮箱验证,注册后不会直接返回会话
        if (!data.session) {
          setNotice(t('注册成功,但项目开启了邮箱验证:请去邮箱点确认链接后回来登录'))
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        // 成功后 AuthContext 收到会话变化,上面的 <Navigate> 自动跳转
      }
    } catch (err) {
      setError(translateAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center overflow-y-auto px-8 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mb-10 text-center">
        <div className="text-5xl">
          <span className="bubble-beat inline-block text-primary">❤</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-primary-dark">{t('双人小屋')}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {mode === 'forgot' ? t('输入邮箱,找回你的密码') : t('只属于我们两个人的地方')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === 'signup' && (
          <input
            className="input"
            type="text"
            placeholder={t('昵称(对方看到的名字)')}
            maxLength={12}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        <input
          className="input"
          type="email"
          placeholder={t('邮箱')}
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode !== 'forgot' && (
          <div className="relative">
            <input
              className="input w-full pr-11"
              type={showPw ? 'text' : 'password'}
              placeholder={t('密码(至少 6 位)')}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={t('显示或隐藏密码')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-gray-400"
            >
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
        )}
        {mode === 'signup' && (
          <input
            className="input"
            type={showPw ? 'text' : 'password'}
            placeholder={t('再输入一次密码确认')}
            required
            minLength={6}
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {notice && <p className="text-sm text-amber-600">{notice}</p>}

        <button
          type="submit"
          disabled={submitting || (mode === 'forgot' && cooldown > 0)}
          className="btn-primary mt-2"
        >
          {submitting
            ? t('请稍候…')
            : mode === 'forgot' && cooldown > 0
              ? t('已发送,{n} 秒后可重发', { n: cooldown })
              : mode === 'login'
                ? t('登录')
                : mode === 'signup'
                  ? t('注册')
                  : t('发送重置邮件')}
        </button>

        {mode === 'forgot' && (
          <p className="text-center text-xs text-gray-400">
            {t('重置邮件每小时只能发送几封,发送后请耐心等待,不要反复点击')}
          </p>
        )}
      </form>

      <div className="mt-6 flex flex-col items-center gap-3">
        {mode === 'login' && (
          <>
            <button type="button" className="text-sm text-gray-400" onClick={() => switchMode('signup')}>
              {t('还没有账号?点这里注册')}
            </button>
            <button type="button" className="text-sm text-gray-400" onClick={() => switchMode('forgot')}>
              {t('忘记密码?')}
            </button>
          </>
        )}
        {mode !== 'login' && (
          <button type="button" className="text-sm text-gray-400" onClick={() => switchMode('login')}>
            {t('返回登录')}
          </button>
        )}
      </div>
    </div>
  )
}
