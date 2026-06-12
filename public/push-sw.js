// Service Worker 的推送处理(经 workbox importScripts 注入主 SW)

// 收到推送 → 弹系统通知
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // 非 JSON 负载就用默认文案
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '双人小屋', {
      body: data.body || '收到一条新消息',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // 相同 tag 的通知会互相覆盖,避免锁屏被同一人的连续消息刷屏
      tag: 'couple-chat',
      data: { url: '/' },
    }),
  )
})

// 点通知 → 聚焦已打开的窗口,没有就新开
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus()
      }
      return clients.openWindow(event.notification.data?.url || '/')
    }),
  )
})
