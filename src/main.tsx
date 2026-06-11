import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initPrefs } from './lib/prefs'
import './index.css'

// 渲染前恢复本机偏好(字体大小、主题色),避免首屏闪一下默认样式
initPrefs()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
