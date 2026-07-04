import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry, friendlyWriteError } from '../lib/net'
import type { Profile } from '../types/db'
import { t } from '../lib/i18n'

const MOOD_EMOJIS = [
  '😊', '🥰', '😍', '🤗', '😌', '😎', '🤩', '🥳',
  '😴', '😪', '🥱', '😋', '🤤', '😇', '🙃', '😅',
  '😢', '😭', '🥺', '😔', '😞', '😣', '😟', '😩',
  '😡', '😤', '🤬', '😒', '🙄', '😶', '😐', '😬',
  '🤒', '🤕', '🤧', '😷', '🥶', '🥵', '🤯', '🫠',
  '❤️', '💔', '✨', '🎉', '🌈', '☀️', '🌙', '⭐',
]

/** 心情是否仍有效(24 小时内) */
export function moodValid(p: Profile | null): string | null {
  if (!p?.mood || !p.mood_at) return null
  return Date.now() - new Date(p.mood_at).getTime() < 24 * 60 * 60 * 1000 ? p.mood : null
}

/** 「今日心情」卡:设置自己的心情,对方在聊天顶部与名片上可见 */
export default function MoodCard({
  profile,
  onSaved,
  onToast,
}: {
  profile: Profile
  onSaved: () => Promise<void>
  onToast: (msg: string) => void
}) {
  const current = moodValid(profile)
  const [editing, setEditing] = useState(false)
  const [emoji, setEmoji] = useState(MOOD_EMOJIS[0])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (value: string | null) => {
    if (busy) return
    setBusy(true)
    try {
      // 幂等 PATCH,弱网可安全重试
      await withRetry(async () => {
        const { error } = await supabase
          .from('profiles')
          .update({ mood: value, mood_at: value ? new Date().toISOString() : null })
          .eq('id', profile.id)
        if (error) throw error
      })
    } catch (err) {
      onToast(friendlyWriteError(err))
      return
    } finally {
      setBusy(false)
    }
    // 到这里说明已写入成功。刷新只是 best-effort,放在 try 外——它失败也绝不能报「保存失败」
    setEditing(false)
    onToast(value ? t('心情已更新,TA 能看到啦') : t('已清除心情'))
    void onSaved()
  }

  return (
    <div className="mt-4 rounded-2xl bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{t('今日心情')}</p>
        {current && !editing && (
          <button
            type="button"
            onClick={() => void save(null)}
            className="text-xs text-gray-300"
          >
            {t('清除')}
          </button>
        )}
      </div>

      {!editing ? (
        <button
          type="button"
          onClick={() => {
            if (current) {
              const sp = current.indexOf(' ')
              if (sp > 0) {
                setEmoji(current.slice(0, sp))
                setText(current.slice(sp + 1))
              } else {
                // 纯 emoji(无文字):整体就是表情,否则选择器会被重置为默认表情
                setEmoji(current)
                setText('')
              }
            }
            setEditing(true)
          }}
          className="mt-2 w-full rounded-xl bg-soft px-4 py-3 text-left"
        >
          {current ? (
            <span className="deco-bob inline-block text-base">{current}</span>
          ) : (
            <span className="text-sm text-gray-400">{t('点击设置今天的心情,TA 会看到 →')}</span>
          )}
        </button>
      ) : (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1.5">
            {MOOD_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`rounded-lg px-2 py-1 text-xl ${emoji === e ? 'bg-soft ring-1 ring-primary' : ''}`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="input min-w-0 flex-1 py-2"
              type="text"
              placeholder={t('一句话心情,比如:好想吃火锅')}
              maxLength={14}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(`${emoji} ${text.trim()}`.trim())}
              className="btn-primary px-4 py-2"
            >
              {t('保存')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
