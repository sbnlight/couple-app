import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Splash } from '../components/Guard'
import { t } from '../lib/i18n'

/**
 * 重设密码页。
 * 用户点击重置邮件里的链接后跳到这里,此时 supabase-js 已自动
 * 从链接中恢复出一个临时会话,直接调 updateUser 设置新密码即可。
 */
export default function ResetPassword() {
  const { loading, session } = useAuth()
  const navigate = useNavigate()
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (loading) return <Splash />

  // 没有会话:链接失效/过期,或者直接手动访问了本页
  if (!session) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="text-4xl">⏰</span>
        <p className="text-sm text-gray-500">{t('链接无效或已过期')}</p>
        <Link to="/login" className="text-sm text-primary-dark underline">
          {t('回登录页重新发起「忘记密码」')}
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    if (pw1.length < 6) {
      setError(t('密码至少需要 6 位'))
      return
    }
    if (pw1 !== pw2) {
      setError(t('两次输入的密码不一致'))
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 })
      if (error) throw error
      setDone(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('different from the old')) setError(t('新密码不能和旧密码相同'))
      else if (msg.includes('超时') || msg.includes('Failed to fetch')) setError(t('网络不太好,请重试'))
      else setError(t('出错了:{msg}', { msg }))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="text-4xl">✅</span>
        <p className="text-sm text-gray-500">{t('密码已重设成功')}</p>
        <button type="button" className="btn-primary w-full" onClick={() => navigate('/', { replace: true })}>
          {t('进入小屋')}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center px-8">
      <div className="mb-8 text-center">
        <div className="text-5xl">🔑</div>
        <h1 className="mt-3 text-xl font-bold text-primary-dark">{t('设置新密码')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          className="input"
          type="password"
          placeholder={t('新密码(至少 6 位)')}
          required
          minLength={6}
          autoComplete="new-password"
          value={pw1}
          onChange={(e) => setPw1(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder={t('再输入一次确认')}
          required
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary mt-2">
          {busy ? t('请稍候…') : t('确认重设')}
        </button>
      </form>
    </div>
  )
}
