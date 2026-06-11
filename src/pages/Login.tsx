import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Splash } from '../components/Guard'

/** 把 Supabase 的英文报错翻译成中文提示 */
function translateAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Invalid login credentials')) return '邮箱或密码不正确'
  if (msg.toLowerCase().includes('already registered')) return '该邮箱已注册,请直接登录'
  if (msg.includes('at least 6 characters')) return '密码至少需要 6 位'
  if (msg.includes('valid email') || msg.includes('invalid format')) return '请输入有效的邮箱地址'
  if (msg.includes('rate limit') || msg.includes('security purposes')) return '操作太频繁,请稍等一会再试'
  if (msg.includes('超时') || msg.includes('abort')) return '网络超时,请检查网络后重试'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return '连不上服务器,请检查网络'
  return `出错了:${msg}`
}

/** 登录 / 注册页(同页切换) */
export default function Login() {
  const { loading, session } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (loading) return <Splash />
  // 已登录则交给守卫决定:去配对页还是主界面
  if (session) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    setNotice('')
    if (mode === 'signup' && !displayName.trim()) {
      setError('给自己起个昵称吧')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // display_name 会被数据库触发器写进 profiles 表
          options: { data: { display_name: displayName.trim() } },
        })
        if (error) throw error
        // 若 Supabase 后台没有关闭邮箱验证,注册后不会直接返回会话
        if (!data.session) {
          setNotice('注册成功,但项目开启了邮箱验证:请去邮箱点确认链接后回来登录(建议在 Supabase 后台关闭 Confirm email)')
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
    <div className="mx-auto flex h-full max-w-md flex-col justify-center px-8">
      <div className="mb-10 text-center">
        <div className="text-5xl">❤</div>
        <h1 className="mt-3 text-2xl font-bold text-primary-dark">双人小屋</h1>
        <p className="mt-1 text-sm text-gray-400">只属于我们两个人的地方</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === 'signup' && (
          <input
            className="input"
            type="text"
            placeholder="昵称(对方看到的名字)"
            maxLength={12}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        <input
          className="input"
          type="email"
          placeholder="邮箱"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="密码(至少 6 位)"
          required
          minLength={6}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
        {notice && <p className="text-sm text-amber-600">{notice}</p>}

        <button type="submit" disabled={submitting} className="btn-primary mt-2">
          {submitting ? '请稍候…' : mode === 'login' ? '登录' : '注册'}
        </button>
      </form>

      <button
        type="button"
        className="mt-6 text-center text-sm text-gray-400"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError('')
          setNotice('')
        }}
      >
        {mode === 'login' ? '还没有账号?点这里注册' : '已有账号?点这里登录'}
      </button>
    </div>
  )
}
