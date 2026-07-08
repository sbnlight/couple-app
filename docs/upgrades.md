# 双人小屋 · 体验升级台账(10 项)

> 本轮目标:在不破坏现有功能前提下,对现有功能做 10 个 UI/交互/特效升级。
> 分支 `dev-a`,一升级一 commit,`npm run build` 必过,只推 dev-a 不上线。
> 状态:待做 / 进行 / 完成(build过) / 已验证(用户真机确认)。全部 needs_db=false。

## 进度总览

| 序 | 批 | 升级 | 主要改动文件 | 状态 | commit |
|---|---|---|---|---|---|
| U8  | 批1 | 主题色/深浅切换柔和过渡 | index.css, prefs.ts, Us.tsx | 完成(build过) | 本批提交 |
| U2  | 批1 | 「已读」柔入 + 小心跳 | MessageBubble.tsx, index.css | 完成(build过) | 本批提交 |
| U10 | 批1 | 图片/表情包加载淡入 | MessageBubble.tsx, index.css | 完成(build过) | 本批提交 |
| U3  | 批2 | 聊天高频动作手感(长按弹入+触觉、发送键回弹) | Chat.tsx, MessageBubble.tsx, index.css | 待做 | - |
| U9  | 批2 | CountUp 数字揭晓「高光一闪」 | Fx.tsx, index.css | 待做 | - |
| U4  | 批2 | 记账「拔河」双段对比条 + 两端金额滚动 | Ledger.tsx | 待做 | - |
| U5  | 批3 | 双城「小天空」昼夜天穹(晨昏细分+流星) | TwoCityCard.tsx, index.css | 待做 | - |
| U6  | 批3 | 每日一问「先蒙后揭」揭晓过场 | DailyQA.tsx, index.css | 待做 | - |
| U7  | 批3 | 纪念日/生日「就是今天」自动庆祝 | AnniversaryManager.tsx / Us.tsx | 待做 | - |
| U1  | 批4 | 双人同步撒花(旗舰,需双端联调) | live.ts, GlobalLive.tsx, 触发点 | 待做 | - |

## 验证方式(逐项)
- **U8**:我们页切主题色圆板/深浅色,界面平滑过渡不硬闪;冷启动无过渡闪动。
- **U2**:两台手机,一方发消息、另一方进聊天读到,发送方看「已读」柔入+♡心跳一次。
- **U10**:聊天发/收图片,加载完成时图片淡入而非硬切;失败仍可点重载。
- **U3**:长按消息菜单从气泡弹出+轻震;点发送键有回弹+微震。
- **U9**:进记账/年报/恋爱天数,数字滚到终点有一次轻微高光。
- **U4**:记账月度页看双方支出为左右两段拔河条,两端金额滚动。
- **U5**:双城卡片两地「小天空」随当地时刻晨昏渐变,深夜偶有流星。
- **U6**:每日一问未答时对方答案是遮罩,答完遮罩滑开露出。
- **U7**:把某纪念日/生日设为今天,进我们页当天首次自动撒花。
- **U1**:两台手机,一方触发彩蛋,另一方屏幕几乎同时下同一场爱心雨。

## 逐项日志
(每项完成后在此追加:改了什么 / build 结果 / 真机验证要点)

- **U10 图片/表情包加载淡入**(build过):`MessageBubble.tsx` ChatImage 加 `loaded` 状态(onLoad 置真 + ref `complete` 兜底防缓存图错过 onLoad 而永久透明),img 用 `chat-img-fade`/`is-loaded` 做 opacity+微 scale 淡入(0.25s);`onMediaLoad?.()` 保留(贴底滚动不坏);`index.css` 加 `.chat-img-fade`,reduced-motion 下强制 opacity:1 直显。真机验证:发/收图片时加载完淡入非硬切;失败仍可点重载;弱网重载后重新淡入。
- **U2 已读柔入+小心跳**(build过):`MessageBubble.tsx:705` 的「已读」`<p>` 加 `read-in` 类,前置 `♡`(`read-heart` 一次性弹跳)。纯 CSS 入场(条件渲染挂载即播一次,无 JS state/timer);`index.css` 加 `read-in`/`read-heart` keyframes 并进 reduced-motion 关闭列表(关掉后静态可见)。真机验证:对方读到你最新消息时「♡ 已读」轻柔淡入+心跳一次,只播一次;开系统「减少动态」后应静态直接显示。
- **U8 主题切换柔和过渡**(build过):`prefs.ts` 加 `flashThemeTransition()` 助手 + `applyTheme/applyThemeMode` 可选 `animate` 参数(手动切换才挂 260ms `.theme-anim`,冷启动 initPrefs 不传→不闪);`Us.tsx` 两处调用传 `true`;`index.css` 加 `.theme-anim *` 颜色过渡(0.22s)并在 reduced-motion 块置 none。仅过渡 background/border/color,无新依赖。真机验证:我们页点主题色圆板/切浅深色→界面柔和变色不硬闪;杀进程冷启动首屏无过渡闪动;开系统「减少动态」后手动切换应瞬时无过渡。
