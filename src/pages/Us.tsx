import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { compressImage } from '../lib/image'
import { daysUntil } from '../lib/time'
import { useAnniversaries } from '../hooks/useAnniversaries'
import Avatar from '../components/Avatar'
import PartnerClock from '../components/PartnerClock'
import MomentsCard from '../components/MomentsCard'
import PushSettings from '../components/PushSettings'
import AnniversaryManager from '../components/AnniversaryManager'
import DailyQA from '../components/DailyQA'
import WishList from '../components/WishList'
import NotesPage from '../components/NotesPage'
import YearReport from '../components/YearReport'
import FeatureToggles, { featureOn } from '../components/FeatureToggles'
import MoodCard, { moodValid } from '../components/MoodCard'
import { LANGS, getLang, setLang, t } from '../lib/i18n'
import {
  FONT_SIZES,
  THEMES,
  THEME_MODES,
  applyFontSize,
  applyTheme,
  applyThemeMode,
  getFontSize,
  getTheme,
  getThemeMode,
} from '../lib/prefs'
import type { FontSize, ThemeId, ThemeMode } from '../lib/prefs'

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

/** 修改密码弹层:已登录状态直接改,无需收邮件 */
function ChangePasswordModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    if (busy) return
    if (pw1.length < 6) {
      setErr('密码至少需要 6 位')
      return
    }
    if (pw1 !== pw2) {
      setErr('两次输入的密码不一致')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 })
      if (error) throw error
      onDone()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('different from the old')) setErr('新密码不能和旧密码相同')
      else if (msg.includes('超时') || msg.includes('Failed to fetch')) setErr('网络不太好,请重试')
      else setErr(`出错了:${msg}`)
      setBusy(false)
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
        <h2 className="mb-3 text-center text-base font-semibold">修改密码</h2>
        <div className="flex flex-col gap-3">
          <input
            className="input w-full"
            type="password"
            placeholder="新密码(至少 6 位)"
            autoComplete="new-password"
            autoFocus
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
          />
          <input
            className="input w-full"
            type="password"
            placeholder="再输入一次确认"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
          />
        </div>
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
            disabled={busy}
            onClick={() => void handleSave()}
          >
            {busy ? '保存中…' : '确认修改'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 是否已作为 PWA 全屏安装(在浏览器里打开则显示安装引导)
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)

/** 「我们」设置页:双方信息、小屋名、个性化设置、退出登录 */
export default function Us() {
  const { profile, partner, couple, refresh, signOut } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [showProfileSheet, setShowProfileSheet] = useState(false)
  const [editing, setEditing] = useState<'myName' | 'houseName' | null>(null)
  /** 当前打开的功能页 */
  const [feature, setFeature] = useState<
    'qa' | 'wish' | 'notes' | 'anniv' | 'report' | 'toggles' | null
  >(null)
  const [showPwModal, setShowPwModal] = useState(false)
  const anniversaries = useAnniversaries(couple!.id)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')
  const [fontSize, setFontSize] = useState<FontSize>(getFontSize)
  const [theme, setTheme] = useState<ThemeId>(getTheme)
  const [mode, setMode] = useState<ThemeMode>(getThemeMode)

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

  /**
   * 手动检查更新:有新版本才重启应用(重启时开场动画会标注"已更新");
   * 已是最新则只提示,不打断使用。
   */
  const handleCheckUpdate = async () => {
    showToast('正在检查更新…')
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (!reg) {
        showToast('当前已是最新版本 ✓')
        return
      }
      await reg.update()
      // update() 之后出现 installing/waiting 即代表拉到了新版本
      const hasNew = Boolean(reg.installing || reg.waiting)
      if (hasNew) {
        // 给重启后的开场动画留个标记,显示"已更新"
        sessionStorage.setItem('just-updated', '1')
        showToast('发现新版本,正在更新…')
        setTimeout(() => window.location.reload(), 1200)
      } else {
        showToast('当前已是最新版本 ✓')
      }
    } catch {
      showToast('检查失败,请稍后再试')
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-white/85 backdrop-blur-md px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center">
        <h1 className="text-base font-semibold text-primary-dark">我们</h1>
      </header>

      <div className="page-in flex-1 overflow-y-auto px-5 py-6">
        {/* ---- 小屋名片(纯展示,编辑入口在下方选项列表) ---- */}
        <div className="rounded-2xl bg-white p-5">
          <p className="text-center text-base font-semibold">{couple?.name ?? '双人小屋'}</p>

          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <Avatar profile={profile} />
              <span className="text-sm">{profile?.display_name ?? '我'}</span>
            </div>

            <span className="text-2xl text-primary">❤</span>

            <div className="flex flex-col items-center gap-2">
              <Avatar profile={partner} />
              <span className="text-sm">{partner?.display_name ?? '等待加入'}</span>
              <span className="text-xs text-gray-400">
                <PartnerClock tz={partner?.timezone} prefix="那边" />
              </span>
              {moodValid(partner) && (
                <span className="rounded-full bg-soft px-2 py-0.5 text-xs text-primary-dark">
                  {moodValid(partner)}
                </span>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-gray-400">
            小屋已建立 <span className="font-semibold text-primary-dark">{days}</span> 天
          </p>

          {/* 见面倒数 */}
          {couple?.next_meet_date && daysUntil(couple.next_meet_date) >= 0 && (
            <p className="mt-1 text-center text-sm text-primary-dark">
              ✈️ 距离下次见面还有{' '}
              <span className="font-semibold">{daysUntil(couple.next_meet_date)}</span> 天
              {daysUntil(couple.next_meet_date) === 0 && ',就是今天!'}
            </p>
          )}

          {/* 纪念日 */}
          {anniversaries.list.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-line pt-3">
              {anniversaries.list.map((a) => {
                const n = daysUntil(a.anniv_date)
                return (
                  <p key={a.id} className="text-center text-xs text-gray-400">
                    🎀 {a.title} ·{' '}
                    {n > 0 ? `还有 ${n} 天` : n === 0 ? '就是今天 🎉' : `第 ${-n + 1} 天`}
                  </p>
                )
              })}
            </div>
          )}
        </div>

        {/* ---- 今日心情(对方可见) ---- */}
        {profile && <MoodCard profile={profile} onSaved={refresh} onToast={showToast} />}

        {/* ---- 今日小互动:想你 + 打卡(可在功能开关里关闭) ---- */}
        {(featureOn(couple, 'miss') || featureOn(couple, 'checkin')) && (
          <MomentsCard
            coupleId={couple!.id}
            userId={profile!.id}
            partnerName={partner?.display_name ?? 'TA'}
            onToast={showToast}
            missEnabled={featureOn(couple, 'miss')}
            checkinEnabled={featureOn(couple, 'checkin')}
          />
        )}

        {/* ---- 功能入口 ---- */}
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-white">
          {featureOn(couple, 'daily_qa') && (
            <button
              type="button"
              onClick={() => setFeature('qa')}
              className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-soft"
            >
              <span>💬 每日一问</span>
              <span className="text-gray-300">›</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setFeature('wish')}
            className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-soft"
          >
            <span>🌠 愿望清单</span>
            <span className="text-gray-300">›</span>
          </button>
          <button
            type="button"
            onClick={() => setFeature('notes')}
            className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-soft"
          >
            <span>💌 留言小纸条</span>
            <span className="text-gray-300">›</span>
          </button>
          <button
            type="button"
            onClick={() => setFeature('anniv')}
            className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-soft"
          >
            <span>🎀 纪念日与见面日</span>
            <span className="text-gray-300">›</span>
          </button>
          <button
            type="button"
            onClick={() => setFeature('report')}
            className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-soft"
          >
            <span>🎊 我们的{new Date().getFullYear()}(年度报告)</span>
            <span className="text-gray-300">›</span>
          </button>
        </div>

        {/* ---- 修改资料 / 检查更新 ---- */}
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl bg-white">
          <button
            type="button"
            onClick={() => setShowProfileSheet(true)}
            className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-soft"
          >
            <span>✏️ 修改资料</span>
            <span className="text-gray-300">›</span>
          </button>
          <button
            type="button"
            onClick={() => setFeature('toggles')}
            className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-soft"
          >
            <span>🧩 功能开关</span>
            <span className="text-gray-300">›</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPwModal(true)}
            className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-soft"
          >
            <span>🔑 修改密码</span>
            <span className="text-gray-300">›</span>
          </button>
          <button
            type="button"
            onClick={() => void handleCheckUpdate()}
            className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-soft"
          >
            <span>🔄 检查更新</span>
            <span className="text-gray-300">›</span>
          </button>
        </div>

        {/* ---- 安装引导(已安装为 PWA 时不显示) ---- */}
        {!isStandalone && (
          <div className="mt-4 rounded-2xl bg-white p-5">
            <p className="text-sm font-medium text-gray-500">📲 安装到主屏幕</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              {isIOS
                ? '用 Safari 打开本页 → 点底部「分享」按钮 → 选「添加到主屏幕」,以后就能像 App 一样全屏使用。'
                : '在浏览器菜单中选择「添加到桌面 / 安装应用」,以后就能像 App 一样全屏使用。'}
            </p>
          </div>
        )}

        {/* ---- 新消息推送通知 ---- */}
        <PushSettings
          coupleId={couple!.id}
          userId={profile!.id}
          isIOS={isIOS}
          isStandalone={isStandalone}
          onToast={showToast}
        />

        {/* ---- 本机显示设置(各自手机独立,不影响对方) ---- */}
        <div className="mt-4 rounded-2xl bg-white p-5">
          <p className="text-sm font-medium text-gray-500">{t('语言 / Language')}</p>
          <div className="mt-3 flex gap-2">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  if (l.id !== getLang()) setLang(l.id) // 切换后整页刷新生效
                }}
                className={`flex-1 rounded-xl border py-2 text-sm transition-colors ${
                  getLang() === l.id
                    ? 'border-primary bg-soft font-medium text-primary-dark'
                    : 'border-line text-gray-500'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <p className="mt-5 text-sm font-medium text-gray-500">{t('外观')}</p>
          <div className="mt-3 flex gap-2">
            {THEME_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  applyThemeMode(m.id)
                  setMode(m.id)
                }}
                className={`flex-1 rounded-xl border py-2 text-sm transition-colors ${
                  mode === m.id
                    ? 'border-primary bg-soft font-medium text-primary-dark'
                    : 'border-line text-gray-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <p className="mt-5 text-sm font-medium text-gray-500">字体大小</p>
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

      {/* 修改资料底部弹层:每项右侧显示当前值 */}
      {showProfileSheet && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end bg-black/40"
          onClick={() => setShowProfileSheet(false)}
        >
          <div
            className="mx-auto w-full max-w-md rounded-t-2xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="border-b border-line py-3 text-center text-sm font-medium text-gray-500">
              修改资料
            </p>
            <div className="divide-y divide-line">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-between px-5 py-3.5 active:bg-soft disabled:opacity-50"
              >
                <span>我的头像</span>
                <span className="flex items-center gap-2 text-gray-400">
                  {uploading ? (
                    <span className="text-sm">上传中…</span>
                  ) : (
                    <Avatar profile={profile} size={36} />
                  )}
                  <span className="text-gray-300">›</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setEditing('myName')}
                className="flex w-full items-center justify-between px-5 py-3.5 active:bg-soft"
              >
                <span>我的昵称</span>
                <span className="flex items-center gap-2 text-sm text-gray-400">
                  {profile?.display_name}
                  <span className="text-gray-300">›</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setEditing('houseName')}
                className="flex w-full items-center justify-between px-5 py-3.5 active:bg-soft"
              >
                <span>小屋名字</span>
                <span className="flex items-center gap-2 text-sm text-gray-400">
                  {couple?.name}
                  <span className="text-gray-300">›</span>
                </span>
              </button>
            </div>
            <button
              type="button"
              className="mt-2 w-full border-t border-line py-3.5 text-center text-gray-500 active:bg-soft"
              onClick={() => setShowProfileSheet(false)}
            >
              完成
            </button>
          </div>
        </div>
      )}

      {/* 功能页(全屏覆盖) */}
      {feature === 'qa' && (
        <DailyQA
          coupleId={couple!.id}
          userId={profile!.id}
          partnerName={partner?.display_name ?? 'TA'}
          onClose={() => setFeature(null)}
        />
      )}
      {feature === 'wish' && (
        <WishList
          coupleId={couple!.id}
          userId={profile!.id}
          partnerName={partner?.display_name ?? 'TA'}
          onClose={() => setFeature(null)}
        />
      )}
      {feature === 'notes' && (
        <NotesPage
          coupleId={couple!.id}
          userId={profile!.id}
          partnerName={partner?.display_name ?? 'TA'}
          onClose={() => setFeature(null)}
        />
      )}
      {feature === 'toggles' && couple && (
        <FeatureToggles
          couple={couple}
          onChanged={refresh}
          onClose={() => setFeature(null)}
          onToast={showToast}
        />
      )}
      {feature === 'report' && couple && (
        <YearReport
          coupleId={couple.id}
          userId={profile!.id}
          myName={profile?.display_name ?? '我'}
          partnerName={partner?.display_name ?? 'TA'}
          coupleCreatedAt={couple.created_at}
          onClose={() => setFeature(null)}
        />
      )}
      {feature === 'anniv' && couple && (
        <AnniversaryManager
          couple={couple}
          anniversaries={anniversaries.list}
          onAdd={anniversaries.add}
          onRemove={anniversaries.remove}
          onCoupleChanged={refresh}
          onClose={() => setFeature(null)}
          onToast={showToast}
        />
      )}

      {showPwModal && (
        <ChangePasswordModal
          onClose={() => setShowPwModal(false)}
          onDone={() => showToast('密码已修改 ✓')}
        />
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
