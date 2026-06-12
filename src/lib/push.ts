import { supabase } from './supabase'

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** VAPID 公钥是否已配置(缺失时设置页显示提示而非报错) */
export const pushConfigured = Boolean(PUBLIC_KEY)

/** 当前浏览器是否具备 Web Push 能力(华为自带浏览器很可能返回 false) */
export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** base64url 公钥 → pushManager.subscribe 需要的字节数组 */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

/** 本设备当前的推送订阅(没有则为 null) */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return null
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

/** 申请通知权限并订阅推送,订阅信息存入数据库 */
export async function subscribePush(coupleId: string, userId: string): Promise<void> {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('PERMISSION_DENIED')

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
  })
  const json = sub.toJSON()
  if (!json.keys?.p256dh || !json.keys.auth) throw new Error('NO_KEYS')

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      couple_id: coupleId,
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

/** 取消本设备的推送订阅 */
export async function unsubscribePush(): Promise<void> {
  const sub = await getExistingSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
