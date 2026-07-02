import { Component, type ReactNode } from 'react'
import { t } from '../lib/i18n'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * 全局错误边界:任一子组件在渲染期抛错(脏数据、坏 JSON、iOS 缺失的 API 等)
 * 时,兜底显示"出错了"页面并提供重载按钮,而不是让整个 React 树卸载 → 白屏。
 *
 * 注意:PWA(autoUpdate)已缓存 App Shell,一旦白屏用户刷新仍白屏、只能清缓存,
 * 所以这层兜底对"两人每天在用"的 App 尤其重要。放在最外层(main.tsx),
 * 连 AuthProvider/Router 内的错误也能接住。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: unknown) {
    // 仅打印到控制台,便于真机连调时定位;不上报第三方(0 成本 + 隐私)
    console.error('[ErrorBoundary] 渲染出错:', error, info)
  }

  handleReload = () => {
    // 清掉可能损坏的一次性会话标记后硬重载
    try {
      sessionStorage.clear()
    } catch {
      // 忽略:隐私模式下 sessionStorage 可能不可用
    }
    location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="text-5xl">😵‍💫</span>
        <p className="text-sm text-gray-500">
          {t('出错了,刚才这一步没能显示出来。')}
          <br />
          {t('点下面的按钮重新载入,通常就好了。')}
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-full bg-rose-400 px-6 py-2 text-sm font-medium text-white shadow active:scale-95"
        >
          {t('重新载入')}
        </button>
      </div>
    )
  }
}
