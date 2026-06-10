/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// 环境变量类型声明(M1 接入 Supabase 时使用)
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
