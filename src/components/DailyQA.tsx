import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/image'
import { getSignedUrl } from '../lib/storage'
import { questionForDate } from '../lib/questions'
import { todayInTz } from '../lib/time'
import { fireEffect } from '../lib/effects'
import type { DailyAnswer } from '../types/db'
import { t } from '../lib/i18n'

/** 回答里附的图片(私有桶签名 URL) */
function QAImage({ path, onPreview }: { path: string; onPreview: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    getSignedUrl('chat-images', path).then((u) => {
      if (!cancelled) setUrl(u)
    })
    return () => {
      cancelled = true
    }
  }, [path])
  if (!url) return <div className="aspect-square w-full animate-pulse rounded-lg bg-line" />
  return (
    <img
      src={url}
      alt="回答配图"
      className="aspect-square w-full rounded-lg object-cover"
      onClick={() => onPreview(url)}
    />
  )
}

/**
 * 每日一问(全屏覆盖页)。
 * 规则:回答完当天的问题,才能看到对方的答案(数据库强制);
 * 回答支持文字 + 一张配图(图片存 chat-images 私有桶)。
 */
export default function DailyQA({
  coupleId,
  userId,
  partnerName,
  dayTz,
  onClose,
}: {
  coupleId: string
  userId: string
  partnerName: string
  /** 两人共用的换日时区(决定「今天」) */
  dayTz: string
  onClose: () => void
}) {
  const today = todayInTz(dayTz)
  const question = questionForDate(today)
  const MAX_IMGS = 9
  const [draft, setDraft] = useState('')
  const [imgs, setImgs] = useState<{ blob: Blob; url: string }[]>([])
  const [mine, setMine] = useState<DailyAnswer | null>(null)
  const [theirs, setTheirs] = useState<DailyAnswer | null>(null)
  const [theyAnswered, setTheyAnswered] = useState(false)
  const [history, setHistory] = useState<DailyAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [viewer, setViewer] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const [todayRes, partnerRes, histRes] = await Promise.all([
      supabase
        .from('daily_answers')
        .select('*')
        .eq('couple_id', coupleId)
        .eq('question_date', today),
      supabase.rpc('partner_answered', { cid: coupleId, qdate: today }),
      supabase
        .from('daily_answers')
        .select('*')
        .eq('couple_id', coupleId)
        .lt('question_date', today)
        .order('question_date', { ascending: false })
        .limit(40),
    ])
    const rows = (todayRes.data as DailyAnswer[] | null) ?? []
    const mineRow = rows.find((r) => r.user_id === userId) ?? null
    const theirsRow = rows.find((r) => r.user_id !== userId) ?? null
    setMine(mineRow)
    setTheirs(theirsRow)
    setTheyAnswered(Boolean(partnerRes.data))
    setHistory((histRes.data as DailyAnswer[] | null) ?? [])
    setLoading(false)
    // 默契时刻:双方都答完今天的问题,撒一次花(每天每设备一次)
    if (mineRow && theirsRow) {
      const key = `qa-fx-${today}`
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        fireEffect(['✨', '💞', '🎊'], 30)
      }
    }
  }, [coupleId, userId, today])

  useEffect(() => {
    void load()
  }, [load])

  const pickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length === 0) return
    const room = MAX_IMGS - imgs.length
    for (const file of files.slice(0, room)) {
      try {
        const blob = await compressImage(file, 1280, 0.8)
        setImgs((prev) =>
          prev.length >= MAX_IMGS ? prev : [...prev, { blob, url: URL.createObjectURL(blob) }],
        )
      } catch {
        // 单张读图失败跳过,继续处理其余
      }
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if ((!content && imgs.length === 0) || busy) return
    setBusy(true)
    try {
      // 先传图(若有);编辑时选了新图则整组替换,否则保留原图
      let imagePaths: string[] | null = editing ? (mine?.image_paths ?? null) : null
      if (imgs.length > 0) {
        const paths: string[] = []
        for (const im of imgs) {
          const path = `${coupleId}/qa-${crypto.randomUUID()}.jpg`
          const { error: upErr } = await supabase.storage
            .from('chat-images')
            .upload(path, im.blob, { contentType: 'image/jpeg' })
          if (upErr) throw upErr
          paths.push(path)
        }
        imagePaths = paths
      }

      if (mine && editing) {
        const { error } = await supabase
          .from('daily_answers')
          .update({ content, image_paths: imagePaths })
          .eq('id', mine.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('daily_answers').insert({
          couple_id: coupleId,
          user_id: userId,
          question_date: today,
          content,
          image_paths: imagePaths,
        })
        if (error) throw error
      }
      setDraft('')
      setImgs([])
      setEditing(false)
      await load() // 答完即可看到对方的答案
    } catch {
      // 失败保留草稿
    } finally {
      setBusy(false)
    }
  }

  /** 渲染一条回答(文字 + 九宫格配图) */
  const renderAnswer = (a: DailyAnswer) => (
    <>
      {a.content && <p className="mt-1 whitespace-pre-wrap text-sm">{a.content}</p>}
      {a.image_paths && a.image_paths.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1">
          {a.image_paths.map((p) => (
            <QAImage key={p} path={p} onPreview={(u) => setViewer(u)} />
          ))}
        </div>
      )}
    </>
  )

  // 往期按日期归并
  const historyByDate = new Map<string, DailyAnswer[]>()
  for (const a of history) {
    const list = historyByDate.get(a.question_date)
    if (list) list.push(a)
    else historyByDate.set(a.question_date, [a])
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-warmbg">
      <header className="flex items-center gap-2 border-b border-line bg-white/85 backdrop-blur-md px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="px-1 text-2xl text-gray-400">
          ‹
        </button>
        <h1 className="text-base font-semibold text-primary-dark">{t('每日一问')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* 今日问题 */}
        <div className="rounded-2xl bg-white p-5">
          <p className="text-xs text-gray-400">{t('今日问题 · {d}', { d: today })}</p>
          <p className="mt-2 text-base font-medium leading-relaxed">{question}</p>

          {loading ? (
            <p className="mt-4 text-sm text-gray-300">{t('加载中…')}</p>
          ) : mine && !editing ? (
            <>
              <div className="mt-4 rounded-xl bg-soft p-3">
                <p className="text-xs text-gray-400">{t('我的回答')}</p>
                {renderAnswer(mine)}
                <button
                  type="button"
                  className="mt-1 text-xs text-gray-400 underline"
                  onClick={() => {
                    setDraft(mine.content)
                    setEditing(true)
                  }}
                >
                  {t('修改')}
                </button>
              </div>
              <div className="mt-3 rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-400">{t('{name}的回答', { name: partnerName })}</p>
                {theirs ? (
                  renderAnswer(theirs)
                ) : (
                  <p className="mt-1 text-sm text-gray-300">{t('TA 还没回答,耐心等等~')}</p>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="mt-4">
              <textarea
                className="input w-full resize-none"
                rows={3}
                maxLength={500}
                placeholder={t('写下你的回答…(也可以只发一张图)')}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />

              {/* 配图(最多 9 张) */}
              <div className="mt-2 grid grid-cols-4 gap-2">
                {imgs.map((im, i) => (
                  <span key={im.url} className="relative">
                    <img
                      src={im.url}
                      alt={`待发送配图${i + 1}`}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImgs((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs text-white"
                      aria-label="移除这张图"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {imgs.length < MAX_IMGS && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-line text-xl text-gray-300"
                    aria-label="添加配图"
                  >
                    📷
                  </button>
                )}
              </div>
              {editing && (mine?.image_paths?.length ?? 0) > 0 && imgs.length === 0 && (
                <p className="mt-1 text-xs text-gray-300">{t('(保留原配图;选了新图则整组替换)')}</p>
              )}

              <p className="mt-2 text-xs text-gray-400">
                {theyAnswered
                  ? t('{name}已经回答了,写下你的答案就能看到 👀', { name: partnerName })
                  : t('{name}还没回答;你答完后,TA 的答案一出来就能看到', { name: partnerName })}
              </p>
              <button
                type="submit"
                disabled={busy || (!draft.trim() && imgs.length === 0)}
                className="btn-primary mt-3 w-full"
              >
                {busy ? t('提交中…') : editing ? t('保存修改') : t('提交回答')}
              </button>
            </form>
          )}
        </div>

        {/* 往期回顾 */}
        {historyByDate.size > 0 && (
          <div className="mt-4">
            <p className="mb-2 px-1 text-xs text-gray-400">{t('往期回顾')}</p>
            {[...historyByDate.entries()].map(([date, answers]) => (
              <div key={date} className="mb-3 rounded-2xl bg-white p-4">
                <p className="text-xs text-gray-400">{date}</p>
                <p className="mt-1 text-sm font-medium">{questionForDate(date)}</p>
                {answers.map((a) => (
                  <div key={a.id} className="mt-2 text-sm">
                    <span className="text-gray-400">
                      {a.user_id === userId ? t('我') : partnerName}:
                    </span>
                    {a.content}
                    {a.image_paths && a.image_paths.length > 0 && (
                      <div className="mt-1.5 grid grid-cols-4 gap-1">
                        {a.image_paths.map((p) => (
                          <QAImage key={p} path={p} onPreview={(u) => setViewer(u)} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void pickImage(e)}
      />

      {/* 全屏看图 */}
      {viewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setViewer(null)}
        >
          <img src={viewer} alt="查看图片" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  )
}
