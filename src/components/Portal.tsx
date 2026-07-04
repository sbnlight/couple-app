import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * 把子节点渲染到 document.body。
 * 用途:全屏/居中的 fixed 弹层若渲染在有 transform 的祖先(如 .page-in 入场动画)里,
 * 会被"困"在该祖先的盒子里(定位不再相对视口,表现为弹层跑到页面顶部)。
 * 用 Portal 挂到 body 下即可让 fixed 恢复相对视口——居中就是真的屏幕居中。
 */
export default function Portal({ children }: { children: ReactNode }) {
  const [el] = useState(() => document.createElement('div'))
  useEffect(() => {
    document.body.appendChild(el)
    return () => {
      document.body.removeChild(el)
    }
  }, [el])
  return createPortal(children, el)
}
