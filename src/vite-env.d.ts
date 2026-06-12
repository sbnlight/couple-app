/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// 环境变量类型声明(M1 接入 Supabase 时使用)
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Web Push 的 VAPID 公钥(可公开;未配置时通知功能显示提示) */
  readonly VITE_VAPID_PUBLIC_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
