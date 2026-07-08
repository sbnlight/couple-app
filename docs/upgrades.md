# 双人小屋 · 体验升级台账(10 项)

> 本轮目标:在不破坏现有功能前提下,对现有功能做 10 个 UI/交互/特效升级。
> 分支 `dev-a`,一升级一 commit,`npm run build` 必过,只推 dev-a 不上线。
> 状态:待做 / 进行 / 完成(build过) / 已验证(用户真机确认)。全部 needs_db=false。

## 进度总览

| 序 | 批 | 升级 | 主要改动文件 | 状态 | commit |
|---|---|---|---|---|---|
| U8  | 批1 | 主题色/深浅切换柔和过渡 | index.css, prefs.ts, Us.tsx | 已上线master | 78479f8 |
| U2  | 批1 | 「已读」柔入 + 小心跳 | MessageBubble.tsx, index.css | 已上线master | 78479f8 |
| U10 | 批1 | 图片/表情包加载淡入 | MessageBubble.tsx, index.css | 已上线master | 78479f8 |
| U3  | 批2 | 聊天高频动作手感(长按弹入+触觉、发送键回弹) | Chat.tsx, MessageBubble.tsx, index.css | 完成(build过) | 待推 |
| U9  | 批2 | CountUp 数字揭晓「高光一闪」 | Fx.tsx, index.css, Us.tsx, Ledger.tsx | 完成(build过) | 待推 |
| U4  | 批2 | 记账「拔河」双段对比条 + 两端金额滚动 | Ledger.tsx, index.css | 完成(build过) | 待推 |
| U5  | 批3 | 双城「小天空」昼夜天穹(晨昏细分+流星) | TwoCityCard.tsx, index.css, i18n.ts | 完成(build过) | 待推 |
| U6  | 批3 | 每日一问「先蒙后揭」揭晓过场 | DailyQA.tsx, index.css, i18n.ts | 完成(build过·reviewer无阻断) | 待推 |
| U7  | 批3 | 纪念日/生日「就是今天」庆祝(类型化) | effects.ts, GlobalLive.tsx, AnniversaryManager.tsx | 完成(build过) | 待推 |
| U1  | 批4 | 双人同步撒花(旗舰) | live.ts, GlobalLive.tsx, Us.tsx, i18n.ts | 完成(build过·reviewer无阻断) | 待推 |

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

- **U1 双人同步撒花**(build过,reviewer 审无阻断):`live.ts` LiveEvent 加 `'fx'`(union+订阅数组两处);`GlobalLive` 加 `onLive('fx')`(emojis 校验为非空字符串≤8、count clamp 1-40)→ 本地 fireEffect;`Us` 恋爱大卡加 onClick `celebrateTogether`(2.5s 防连点:本地 fireEffect + sendLive('fx') 广播 + vibrate),表情组烟花+爱心 `🎆🎇❤️💕✨` 与提示文案一致;`i18n` 补提示三语。发送方 self:false 靠本地自放、接收方广播各放一次不重不漏。真机验证:两台手机,一方点「恋爱计数大卡」,两屏几乎同时下同一场烟花爱心雨。
- **U7 纪念日/生日庆祝类型化**(build过):GlobalLive **已有**「当天每设备一次撒花」(通用🎉🎊💕✨),本次升级为**按类型定制**——见面日→✈️💕🎊、生日→🎂🎉🎈、周年→🌹💝✨;`effects.ts` 加 `isBirthdayTitle`(中/英/日关键词)复用;AnniversaryManager 今天药丸前加 🎂/🎉。未改去重键/触发点/i18n。真机验证:把某纪念日设为今天(或改标题含「生日」),当天首次进 App 自动撒对应表情;管理器里今天项药丸带蛋糕/彩带。
- **U6 每日一问先蒙后揭**(build过,reviewer 审无阻断):`DailyQA` 未答时表单加磨砂预告卡(🙈 答完就能看到);新 state `justAnswered` 首答置真,对方答案卡盖 `qa-reveal` 遮罩滑开露出(onAnimationEnd 复位;both+pointer-events-none 与 reduce opacity:0 双保险,答案绝不被永久挡);`index.css` 加 keyframe 进 reduced-motion;`i18n` 补两条三语。真机验证:未答见磨砂预告卡;首次答完对方答案卡遮罩滑开;编辑保存不播;减少动态下答案直显不被挡。
- **U5 双城昼夜天穹**(build过,Lead 验证:边界0-23无缝/JIT产物确认/dark流星内联白/reduce已关):`TwoCityCard` CityCol 昼夜从 3 段扩 5 段(黎明5-7/白天7-17/黄昏17-19/暮色19-21/深夜),SKY 配置表(tint/emoji/text);暮色+深夜显星,深夜加 `city-shoot` 低频流星(15s单元素);`index.css` 加 keyframe 进 reduced-motion 关闭;`i18n` 补黎明/白天/黄昏/暮色/夜晚三语。真机验证:双城两地「小天空」随当地时刻晨昏渐变,深夜偶有流星划过。
- **U3 聊天手感**(build过):`MessageBubble.startPress` 长按命中 `vibrate(15)`;`Chat.handleSubmit` 发送 `vibrate(8)`;发送键加 `press-pop` 按压回弹(:active scale.9);长按菜单拆内外两层——外层定位、内层 `menu-pop` 弹入(transformOrigin 随 below 取 top/bottom center,不与定位 transform 冲突),按钮原样;`index.css` 加 menu-pop/press-pop 并进 reduced-motion 关闭。真机验证:长按消息菜单从气泡方向弹出+轻震;点发送键有回弹+微震(iPhone 无震动正常)。
- **U4 记账拔河条 + 金额滚动**(build过,reviewer 审无阻断):`Ledger.tsx` 双方支出对比条改成 `relative` 轨道 + 两个绝对定位 GrowBar(我 primary 靠左、TA gray-400 靠右,pct 和=100 在占比处相接);两端金额 + 分类占比金额换 `CountUp decimals=2 duration=700` 与条同步;TA 圆点同步 gray-400;`index.css` 补 `.bg-gray-400` dark 覆写(#5a5062)。真机验证:记账月度页看双方支出为左右两段拔河、两端金额滚动;深色模式两段可辨。
- **U9 CountUp 数字高光**(build过):`Fx.tsx` CountUp 加可选 `glowOnDone`(默认 false 不影响现有调用,仍返回 Fragment;为真才包 inline-block span,滚到终点 setGlow 触发一次性 `countup-glow`:主题色 text-shadow + scale 1.06,0.7s);`index.css` 加 keyframe 并进 reduced-motion 关闭。已在**恋爱天数大卡(Us:454)**与**记账月度汇总总额(Ledger:498)**启用。真机验证:进「我们」页恋爱天数滚到终点闪一下微光;进记账页汇总总额滚完闪一下;切月金额重滚会重播。
- **U10 图片/表情包加载淡入**(build过):`MessageBubble.tsx` ChatImage 加 `loaded` 状态(onLoad 置真 + ref `complete` 兜底防缓存图错过 onLoad 而永久透明),img 用 `chat-img-fade`/`is-loaded` 做 opacity+微 scale 淡入(0.25s);`onMediaLoad?.()` 保留(贴底滚动不坏);`index.css` 加 `.chat-img-fade`,reduced-motion 下强制 opacity:1 直显。真机验证:发/收图片时加载完淡入非硬切;失败仍可点重载;弱网重载后重新淡入。
- **U2 已读柔入+小心跳**(build过):`MessageBubble.tsx:705` 的「已读」`<p>` 加 `read-in` 类,前置 `♡`(`read-heart` 一次性弹跳)。纯 CSS 入场(条件渲染挂载即播一次,无 JS state/timer);`index.css` 加 `read-in`/`read-heart` keyframes 并进 reduced-motion 关闭列表(关掉后静态可见)。真机验证:对方读到你最新消息时「♡ 已读」轻柔淡入+心跳一次,只播一次;开系统「减少动态」后应静态直接显示。
- **U8 主题切换柔和过渡**(build过):`prefs.ts` 加 `flashThemeTransition()` 助手 + `applyTheme/applyThemeMode` 可选 `animate` 参数(手动切换才挂 260ms `.theme-anim`,冷启动 initPrefs 不传→不闪);`Us.tsx` 两处调用传 `true`;`index.css` 加 `.theme-anim *` 颜色过渡(0.22s)并在 reduced-motion 块置 none。仅过渡 background/border/color,无新依赖。真机验证:我们页点主题色圆板/切浅深色→界面柔和变色不硬闪;杀进程冷启动首屏无过渡闪动;开系统「减少动态」后手动切换应瞬时无过渡。
