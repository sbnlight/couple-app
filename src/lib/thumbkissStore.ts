/**
 * 实时触碰的全局开关:让「触碰」页可以从任意页面打开
 * (例如收到对方"想触碰"提醒时,一点就开),并让 GlobalLive 知道它是否已打开。
 */

type Listener = (open: boolean) => void

let open = false
const listeners = new Set<Listener>()

export function isThumbkissOpen(): boolean {
  return open
}

export function openThumbkiss() {
  if (open) return
  open = true
  listeners.forEach((l) => l(true))
}

export function closeThumbkiss() {
  if (!open) return
  open = false
  listeners.forEach((l) => l(false))
}

export function subscribeThumbkiss(l: Listener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
