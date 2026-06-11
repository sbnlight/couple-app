// 数据库行类型,与 supabase/migrations 中的表结构一一对应

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface Couple {
  id: string
  /** 小屋名称,可由任一成员修改 */
  name: string
  invite_code: string
  member_a: string
  /** 第二人加入前为 null */
  member_b: string | null
  created_at: string
}

export type MessageType = 'text' | 'image' | 'sticker'

export interface Message {
  id: number
  couple_id: string
  sender_id: string
  type: MessageType
  /** 文本内容,或 Storage 图片/表情包路径 */
  content: string
  /** 客户端生成的幂等键,用于发送重试时去重 */
  client_id: string | null
  created_at: string
}

/** 自定义表情包(小屋内共享) */
export interface Sticker {
  id: number
  couple_id: string
  owner_id: string
  path: string
  created_at: string
}

/** 已读位置:每人每小屋一行 */
export interface ReadStatus {
  couple_id: string
  user_id: string
  last_read_id: number
  updated_at: string
}

export interface Expense {
  id: number
  couple_id: string
  payer_id: string
  amount: number
  category: string
  note: string | null
  spent_at: string
  /** 货币代码:CNY/USD/EUR/JPY/GBP */
  currency: string
  /** 收支类型 */
  kind: 'expense' | 'income'
  /** 共同 / 个人(双方均可见) */
  scope: 'shared' | 'personal'
  created_at: string
}
