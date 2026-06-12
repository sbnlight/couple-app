// Edge Function「push」:messages 表新增一行时由 Database Webhook 触发,
// 给消息接收方的所有已订阅设备发 Web Push 通知。
//
// 部署方式(无需本地 CLI):Supabase 控制台 → Edge Functions → Deploy a new function
//   → 函数名 push → 粘贴本文件全部内容 → 关闭 "Enforce JWT verification" → Deploy
// 所需 Secrets(控制台 → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / PUSH_WEBHOOK_SECRET

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// service_role 客户端:仅在服务端使用,可越过 RLS 查订阅
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

webpush.setVapidDetails(
  'mailto:sbn252608@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const ok = () => new Response('ok', { status: 200 })

Deno.serve(async (req) => {
  // 校验来源:必须携带与 Secrets 一致的密钥头,防止外人伪造请求触发推送
  if (req.headers.get('x-push-secret') !== Deno.env.get('PUSH_WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const record = body?.record
  if (!record?.couple_id || !record?.sender_id) return ok()

  // 找出接收方(小屋里的另一个人)
  const { data: couple } = await supabase
    .from('couples')
    .select('member_a, member_b')
    .eq('id', record.couple_id)
    .single()
  if (!couple) return ok()
  const recipient = couple.member_a === record.sender_id ? couple.member_b : couple.member_a
  if (!recipient) return ok()

  const [{ data: sender }, { data: subs }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', record.sender_id).single(),
    supabase.from('push_subscriptions').select('*').eq('user_id', recipient),
  ])
  if (!subs || subs.length === 0) return ok()

  const preview =
    record.type === 'text'
      ? String(record.content).slice(0, 60)
      : record.type === 'image'
        ? '[图片]'
        : '[表情包]'
  const payload = JSON.stringify({
    title: sender?.display_name ?? '双人小屋',
    body: preview,
  })

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
      } catch (err) {
        // 404/410 = 该设备的订阅已失效(用户撤销/换浏览器),清掉这行
        const code = (err as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }
    }),
  )

  return ok()
})
