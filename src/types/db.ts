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

export interface Message {
  id: number
  couple_id: string
  sender_id: string
  type: 'text' | 'image'
  /** 文本内容,或 Storage 图片路径 */
  content: string
  created_at: string
}

export interface Expense {
  id: number
  couple_id: string
  payer_id: string
  amount: number
  category: string
  note: string | null
  spent_at: string
  created_at: string
}
