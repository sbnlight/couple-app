/**
 * 全屏表情雨特效:任意位置调 fireEffect(),由 EffectHost 统一渲染。
 * 通过 window 自定义事件解耦,避免层层传 props。
 */

export interface FxDetail {
  emojis: string[]
  count?: number
}

export function fireEffect(emojis: string[], count = 26) {
  window.dispatchEvent(new CustomEvent<FxDetail>('couple-fx', { detail: { emojis, count } }))
}

/** 消息关键词 → 特效(发送方和接收方都会触发) */
const KEYWORD_EFFECTS: { keys: string[]; emojis: string[] }[] = [
  { keys: ['我爱你', '爱你', 'i love you', 'love you'], emojis: ['❤️', '💕', '💖'] },
  { keys: ['想你', '想死你', 'miss you'], emojis: ['💭', '💗', '🥺'] },
  { keys: ['晚安', 'good night', 'goodnight'], emojis: ['🌙', '⭐', '✨'] },
  { keys: ['早安', '早上好', 'good morning'], emojis: ['☀️', '🌤', '🐤'] },
  { keys: ['生日快乐', 'happy birthday'], emojis: ['🎂', '🎉', '🎁'] },
  { keys: ['么么', 'mua', '亲亲', '😘'], emojis: ['💋', '😘', '💕'] },
  { keys: ['抱抱', 'hug'], emojis: ['🤗', '🫂', '💞'] },
  { keys: ['新年快乐', 'happy new year'], emojis: ['🎆', '🧧', '✨'] },
  { keys: ['节日快乐', '情人节快乐'], emojis: ['🌹', '💝', '✨'] },
]

/** 文本命中关键词则返回对应特效表情组 */
export function keywordEffect(text: string): string[] | null {
  const t = text.toLowerCase()
  for (const e of KEYWORD_EFFECTS) {
    if (e.keys.some((k) => t.includes(k))) return e.emojis
  }
  return null
}
