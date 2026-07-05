import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { compressImage, extFromType } from '../lib/image'
import { getSignedUrl } from '../lib/storage'
import { questionForDate } from '../lib/questions'
import { todayInTz } from '../lib/time'
import { fireEffect } from '../lib/effects'
import { withRetry, friendlyWriteError, isUniqueViolation } from '../lib/net'
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
  const [today, setToday] = useState(() => todayInTz(dayTz))
  // 跨午夜自动换日:回前台/每分钟比对换日时区的日期,变了就刷新「今天」(load 依赖 today 会自动重载)
  useEffect(() => {
    const check = () => setToday((p) => (p === todayInTz(dayTz) ? p : todayInTz(dayTz)))
    const onVis = () => {
      if (!document.hidden) check()
    }
    document.addEventListener('visibilitychange', onVis)
    const timer = window.setInterval(check, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(timer)
    }
  }, [dayTz])
  const question = questionForDate(today)
  const MAX_IMGS = 9
  const [draft, setDraft] = useState('')
  const [imgs, setImgs] = useState<{ blob: Blob; url: string }[]>([])
  // 卸载时回收待发配图的预览 object URL,避免选图/换图/关页面的缓慢内存泄漏
  const imgsRef = useRef(imgs)
  useEffect(() => {
    imgsRef.current = imgs
  }, [imgs])
  useEffect(
    () => () => {
      imgsRef.current.forEach((im) => URL.revokeObjectURL(im.url))
    },
    [],
  )
  // 编辑时保留的原有配图路径(用户可逐张删除);新建时为空
  const [keptPaths, setKeptPaths] = useState<string[]>([])
  const [mine, setMine] = useState<DailyAnswer | null>(null)
  const [theirs, setTheirs] = useState<DailyAnswer | null>(null)
  const [theyAnswered, setTheyAnswered] = useState(false)
  const [history, setHistory] = useState<DailyAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState('')
  const [viewer, setViewer] = useState<string | null>(null)
  // 对方改动提醒 + 历史留言编辑
  const [changedDates, setChangedDates] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContentDraft, setEditContentDraft] = useState('')
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
    const hist = (histRes.data as DailyAnswer[] | null) ?? []
    setHistory(hist)
    setLoading(false)
    // 对方改动提醒:TA 往日回答的 updated_at 比我上次看到的新 → 高亮那些日期
    const SEEN_KEY = `qa-seen-${coupleId}`
    const seen = localStorage.getItem(SEEN_KEY)
    const upAt = (a: DailyAnswer) => (a as DailyAnswer & { updated_at?: string | null }).updated_at ?? ''
    const partnerHist = hist.filter((a) => a.user_id !== userId)
    const maxUp = partnerHist.reduce((m, a) => (upAt(a) > m ? upAt(a) : m), '')
    if (seen === null) {
      // 首次打开:只建立基线、不点亮(否则 0023 给历史行补的 updated_at 会把 TA 每条旧回答都误报为"刚改")
      localStorage.setItem(SEEN_KEY, maxUp)
    } else {
      const changed = new Set(partnerHist.filter((a) => upAt(a) > seen).map((a) => a.question_date))
      if (changed.size > 0) {
        setChangedDates(changed)
        localStorage.setItem(SEEN_KEY, maxUp > seen ? maxUp : seen)
      }
    }
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

  // 回前台时重拉一次:同一天里也能看到 TA 刚提交/改动的回答(异地场景关键)
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [load])

  const pickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length === 0) return
    const room = MAX_IMGS - imgs.length - keptPaths.length
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
    // 编辑时"只保留原图、清空文字"也算有内容(否则按钮点了没反应)
    if ((!content && imgs.length === 0 && keptPaths.length === 0) || busy) return
    setBusy(true)
    setErr('')
    try {
      // 配图 = 编辑时保留的原图(未被删掉的)+ 本次新上传的
      const uploaded: string[] = []
      for (const im of imgs) {
        const path = `${coupleId}/qa-${crypto.randomUUID()}.${extFromType(im.blob.type)}`
        const { error: upErr } = await supabase.storage
          .from('chat-images')
          .upload(path, im.blob, { contentType: im.blob.type || 'image/jpeg' })
        if (upErr) throw upErr
        uploaded.push(path)
      }
      const keep = editing ? keptPaths : []
      const finalPaths = [...keep, ...uploaded]
      const imagePaths: string[] | null = finalPaths.length > 0 ? finalPaths : null

      // 只对「写库」这一步做弱网重试(图片已在上面传好,不会重复上传)
      if (mine && editing) {
        await withRetry(async () => {
          const { error } = await supabase
            .from('daily_answers')
            .update({ content, image_paths: imagePaths })
            .eq('id', mine.id)
          if (error) throw error
        })
      } else {
        await withRetry(async () => {
          const { error } = await supabase.from('daily_answers').insert({
            couple_id: coupleId,
            user_id: userId,
            question_date: today,
            content,
            image_paths: imagePaths,
          })
          // 唯一约束(couple_id,user_id,question_date):重发命中即视为已提交成功
          if (error && !isUniqueViolation(error)) throw error
        })
      }
      // 孤儿清理放在写库成功之后:否则写库失败却已删原图,答案会残留坏图
      if (editing && mine?.image_paths) {
        const removed = mine.image_paths.filter((p) => !keep.includes(p))
        if (removed.length > 0) void supabase.storage.from('chat-images').remove(removed)
      }
      setDraft('')
      imgs.forEach((im) => URL.revokeObjectURL(im.url))
      setImgs([])
      setKeptPaths([])
      setEditing(false)
      await load() // 答完即可看到对方的答案
    } catch (e) {
      // 不再静默丢弃:给出可诊断的提示,草稿保留可重试
      setErr(friendlyWriteError(e))
    } finally {
      setBusy(false)
    }
  }

  /** 保存历史某天我的回答文字(图片保持不变,仅改文字) */
  const saveHistoryEdit = async (id: number) => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await withRetry(async () => {
        const { error } = await supabase
          .from('daily_answers')
          .update({ content: editContentDraft })
          .eq('id', id)
        if (error) throw error
      })
      setEditingId(null)
      await load()
    } catch (e) {
      setErr(friendlyWriteError(e))
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
                    setKeptPaths(mine.image_paths ?? [])
                    setImgs([])
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

              {/* 配图(最多 9 张):编辑时先展示保留的原图(可逐张删),再是新选的图 */}
              <div className="mt-2 grid grid-cols-4 gap-2">
                {editing &&
                  keptPaths.map((p) => (
                    <span key={p} className="relative">
                      <QAImage path={p} onPreview={(u) => setViewer(u)} />
                      <button
                        type="button"
                        onClick={() => setKeptPaths((prev) => prev.filter((x) => x !== p))}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs text-white"
                        aria-label="移除这张原配图"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                {imgs.map((im, i) => (
                  <span key={im.url} className="relative">
                    <img
                      src={im.url}
                      alt={`待发送配图${i + 1}`}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setImgs((prev) => {
                          if (prev[i]) URL.revokeObjectURL(prev[i].url)
                          return prev.filter((_, j) => j !== i)
                        })
                      }
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs text-white"
                      aria-label="移除这张图"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {keptPaths.length + imgs.length < MAX_IMGS && (
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

              <p className="mt-2 text-xs text-gray-400">
                {theyAnswered
                  ? t('{name}已经回答了,写下你的答案就能看到 👀', { name: partnerName })
                  : t('{name}还没回答;你答完后,TA 的答案一出来就能看到', { name: partnerName })}
              </p>
              <button
                type="submit"
                disabled={busy || (!draft.trim() && imgs.length === 0 && keptPaths.length === 0)}
                className="btn-primary mt-3 w-full"
              >
                {busy ? t('提交中…') : editing ? t('保存修改') : t('提交回答')}
              </button>
              {err && <p className="mt-2 text-center text-xs text-red-500">{err}</p>}
            </form>
          )}
        </div>

        {/* 往期回顾 */}
        {historyByDate.size > 0 && (
          <div className="mt-4">
            {changedDates.size > 0 && (
              <div className="modal-pop mb-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-500 ring-1 ring-rose-100">
                💬 {t('{name} 更新了 {n} 天的回答,下面高亮的看看吧', { name: partnerName, n: changedDates.size })}
              </div>
            )}
            <p className="mb-2 px-1 text-xs text-gray-400">{t('往期回顾')}</p>
            {[...historyByDate.entries()].map(([date, answers]) => (
              <div
                key={date}
                className={`mb-3 rounded-2xl bg-white p-4 ${changedDates.has(date) ? 'ring-2 ring-rose-300' : ''}`}
              >
                <p className="text-xs text-gray-400">{date}</p>
                <p className="mt-1 text-sm font-medium">{questionForDate(date)}</p>
                {answers.map((a) => (
                  <div key={a.id} className="mt-2 text-sm">
                    <span className="text-gray-400">
                      {a.user_id === userId ? t('我') : partnerName}:
                    </span>
                    {editingId === a.id ? (
                      <div className="mt-1">
                        <textarea
                          className="input w-full resize-none"
                          rows={2}
                          maxLength={500}
                          value={editContentDraft}
                          onChange={(e) => setEditContentDraft(e.target.value)}
                        />
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveHistoryEdit(a.id)}
                            className="btn-primary flex-1 rounded-full py-1 text-xs disabled:opacity-60"
                          >
                            {t('保存')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="flex-1 rounded-full border border-line py-1 text-xs text-gray-500"
                          >
                            {t('取消')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {a.content}
                        {a.user_id === userId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(a.id)
                              setEditContentDraft(a.content)
                            }}
                            className="ml-1.5 align-middle text-xs text-primary-dark"
                            aria-label="编辑我的回答"
                          >
                            ✏️
                          </button>
                        )}
                      </>
                    )}
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
