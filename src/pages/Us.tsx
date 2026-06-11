import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { compressImage } from '../lib/image'
import Avatar from '../components/Avatar'
import {
  FONT_SIZES,
  THEMES,
  applyFontSize,
  applyTheme,
  getFontSize,
  getTheme,
} from '../lib/prefs'
import type { FontSize, ThemeId } from '../lib/prefs'

/** 单行文本编辑弹层(改昵称/小屋名共用) */
function EditModal({
  title,
  initial,
  maxLength,
  onSave,
  onClose,
}: {
  title: string
  initial: string
  maxLength: number
  onSave: (value: string) => Promise<void>
  onClose: () => void
}) {
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    const v = value.trim()
    if (!v) {
      setErr('名字不能为空')
      return
    }
    setSaving(true)
    setErr('')
    try {
      await onSave(v)
      onClose()
    } catch {
      setErr('保存失败,请检查网络后重试')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-center text-base font-semibold">{title}</h2>
        <input
          className="input w-full"
          value={value}
          maxLength={maxLength}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
        />
        {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-xl border border-line py-2.5 text-gray-500"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="btn-primary flex-1 py-2.5"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 「我们」设置页:双方信息、小屋名、个性化设置、退出登录 */
export default function Us() {
  const { profile, partner, couple, refresh, signOut } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<'myName' | 'houseName' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')
  const [fontSize, setFontSize] = useState<FontSize>(getFontSize)
  const [theme, setTheme] = useState<ThemeId>(getTheme)

  const days = couple
    ? Math.floor((Date.now() - new Date(couple.created_at).getTime()) / 86_400_000) + 1
    : 0

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // ---- 改昵称 / 改小屋名 ----
  const saveMyName = async (v: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: v })
      .eq('id', profile!.id)
    if (error) throw error
    await refresh()
  }

  const saveHouseName = async (v: string) => {
    const { error } = await supabase.from('couples').update({ name: v }).eq('id', couple!.id)
    if (error) throw error
    await refresh()
  }

  // ---- 换头像:相册选图 → 压缩 → 上传私有桶 → 更新 profiles.avatar_url ----
  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 清空以便下次选同一张也能触发 change
    if (!file || !profile || uploading) return
    setUploading(true)
    try {
      const blob = await compressImage(file, 512, 0.85)
      // 时间戳文件名:换头像即换路径,绕开旧签名 URL 的缓存
      const path = `${profile.id}/avatar-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (upErr) throw upErr

      const oldPath = profile.avatar_url
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: path })
        .eq('id', profile.id)
      if (dbErr) throw dbErr

      // 删旧文件省空间;失败也无妨,不阻塞流程
      if (oldPath) void supabase.storage.from('avatars').remove([oldPath])
      await refresh()
      showToast('头像已更新')
    } catch {
      showToast('头像上传失败,请重试')
    } finally {
      setUploading(false)
    }
  }

  // ---- 本机偏好 ----
  const handleFontSize = (id: FontSize) => {
    applyFontSize(id)
    setFontSize(id)
  }
  const handleTheme = (id: ThemeId) => {
    applyTheme(id)
    setTheme(id)
  }

  const handleSignOut = () => {
    if (window.confirm('确定要退出登录吗?')) void signOut()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-base font-semibold text-primary-dark">我们</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* ---- 小屋名片 ---- */}
        <div className="rounded-2xl bg-white p-5">
          <button
            type="button"
            className="mx-auto flex items-center gap-1 text-base font-semibold"
            onClick={() => setEditing('houseName')}
          >
            {couple?.name ?? '双人小屋'}
            <span className="text-xs text-gray-300">✏️</span>
          </button>

          <div className="mt-4 flex items-center justify-center gap-6">
            {/* 自己:点头像换图,点昵称改名 */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                className="relative"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Avatar profile={profile} />
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs shadow">
                  {uploading ? '⏳' : '📷'}
                </span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1 text-sm"
                onClick={() => setEditing('myName')}
              >
                {profile?.display_name ?? '我'}
                <span className="text-xs text-gray-300">✏️</span>
              </button>
            </div>

            <span className="text-2xl text-primary">❤</span>

            {/* 对方:只读展示 */}
            <div className="flex flex-col items-center gap-2">
              <Avatar profile={partner} />
              <span className="text-sm">{partner?.display_name ?? '等待加入'}</span>
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-gray-400">
            小屋已建立 <span className="font-semibold text-primary-dark">{days}</span> 天
          </p>
        </div>

        {/* ---- 本机显示设置(各自手机独立,不影响对方) ---- */}
        <div className="mt-4 rounded-2xl bg-white p-5">
          <p className="text-sm font-medium text-gray-500">字体大小</p>
          <div className="mt-3 flex gap-2">
            {FONT_SIZES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFontSize(f.id)}
                className={`flex-1 rounded-xl border py-2 text-sm transition-colors ${
                  fontSize === f.id
                    ? 'border-primary bg-soft font-medium text-primary-dark'
                    : 'border-line text-gray-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <p className="mt-5 text-sm font-medium text-gray-500">主题色</p>
          <div className="mt-3 flex gap-4">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTheme(t.id)}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  style={{ backgroundColor: t.swatch }}
                  className={`h-9 w-9 rounded-full ${
                    theme === t.id ? 'ring-2 ring-gray-700 ring-offset-2' : ''
                  }`}
                />
                <span className="text-xs text-gray-500">{t.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-300">以上设置只对这台设备生效</p>
        </div>

        {/* ---- 其他操作 ---- */}
        <div className="mt-4 overflow-hidden rounded-2xl bg-white">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full px-5 py-4 text-left text-red-500 active:bg-soft"
          >
            🚪 退出登录
          </button>
        </div>
      </div>

      {/* 隐藏的文件选择器(相册选图) */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />

      {/* 轻提示 */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center">
          <span className="rounded-full bg-gray-800/80 px-4 py-2 text-sm text-white">{toast}</span>
        </div>
      )}

      {editing === 'myName' && (
        <EditModal
          title="修改我的昵称"
          initial={profile?.display_name ?? ''}
          maxLength={12}
          onSave={saveMyName}
          onClose={() => setEditing(null)}
        />
      )}
      {editing === 'houseName' && (
        <EditModal
          title="给小屋起个名字"
          initial={couple?.name ?? '双人小屋'}
          maxLength={16}
          onSave={saveHouseName}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
