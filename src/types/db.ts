// 数据库行类型,与 supabase/migrations 中的表结构一一对应

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  /** IANA 时区(如 Asia/Shanghai),App 打开时自动同步设备时区 */
  timezone: string | null
  /** 今日心情(如 "😴 好困"),24 小时内有效 */
  mood: string | null
  mood_at: string | null
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
  /** 下次见面日期(倒数日) */
  next_meet_date: string | null
  /** 互动功能开关(小屋级共享):缺省开启,显式 false 为关闭 */
  feature_flags: Record<string, boolean> | null
  created_at: string
}

/** 纪念日 */
export interface Anniversary {
  id: number
  couple_id: string
  title: string
  anniv_date: string
  created_at: string
}

/** 每日一问的回答 */
export interface DailyAnswer {
  id: number
  couple_id: string
  user_id: string
  question_date: string
  content: string
  /** 随答案附的图片(chat-images 桶路径,最多 9 张),可为空 */
  image_paths: string[] | null
  created_at: string
}

/** 愿望清单条目 */
export interface Wish {
  id: number
  couple_id: string
  creator_id: string
  content: string
  done: boolean
  done_at: string | null
  created_at: string
}

/** 留言小纸条 */
export interface Note {
  id: number
  couple_id: string
  author_id: string
  content: string
  unlock_at: string
  created_at: string
}

/** 每日打卡(UTC 日期) */
export interface Checkin {
  couple_id: string
  user_id: string
  day: string
  created_at: string
}

export type MessageType = 'text' | 'image' | 'sticker' | 'voice' | 'nudge'

export interface Message {
  id: number
  couple_id: string
  sender_id: string
  type: MessageType
  /** 文本内容,或 Storage 图片/表情包路径 */
  content: string
  /** 客户端生成的幂等键,用于发送重试时去重 */
  client_id: string | null
  /** 已撤回(内容已被清空) */
  recalled: boolean
  /** 引用回复:被引用消息 id + 预览文本 */
  reply_to: number | null
  reply_preview: string | null
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
