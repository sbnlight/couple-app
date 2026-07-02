/**
 * 待发的图片/语音消息本地持久化(IndexedDB)。
 *
 * 背景:文本/表情包的待发队列用 localStorage 存(见 useMessages 的 savePending),
 * 但图片/语音带 Blob,JSON 无法序列化,过去被直接丢弃 —— App 被杀/刷新后这类
 * "发送中/失败"的消息会静默消失,违反 CLAUDE.md「绝不静默丢弃」的约定。
 *
 * IndexedDB 可直接存 Blob(结构化克隆),因此把这类待发记录连同 Blob 落库,
 * 重开时恢复为 failed 状态、可手动重试。发送成功后按 localId 删除。
 */

/** 持久化的一条待发媒体记录(与 useMessages 的 PendingMsg 字段对应) */
export interface PendingMedia {
  localId: string
  coupleId: string
  type: 'image' | 'voice'
  createdAt: string
  blob: Blob
  voiceDur?: number
  voiceExt?: string
  voiceMime?: string
  replyTo?: number
  replyPreview?: string
}

const DB_NAME = 'couple-app'
const STORE = 'pending-media'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    // 某些隐私模式下 indexedDB 不可用 —— 退化为"不持久化",不影响发送主流程
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'localId' })
          os.createIndex('coupleId', 'coupleId', { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

/** 写入/覆盖一条待发媒体 */
export async function putPendingMedia(rec: PendingMedia): Promise<void> {
  const db = await openDB()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(rec)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** 取某小屋所有待发媒体(恢复用) */
export async function getPendingMedia(coupleId: string): Promise<PendingMedia[]> {
  const db = await openDB()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const idx = tx.objectStore(STORE).index('coupleId')
      const req = idx.getAll(coupleId)
      req.onsuccess = () => resolve((req.result as PendingMedia[]) ?? [])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

/** 发送成功/不再需要时按 localId 删除 */
export async function deletePendingMedia(localId: string): Promise<void> {
  const db = await openDB()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(localId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}
