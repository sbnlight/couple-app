# DESIGN.md — 「双人小屋」总体设计

> 依据 CLAUDE.md 编写的实现蓝图。开发按 M0–M4 推进，每个里程碑结束交付可跑版本并等待真机验收。
> 本文与 CLAUDE.md 冲突时，以 CLAUDE.md 为准。

---

## 1. 架构总览

```
┌─────────────────────────────────────────────┐
│  手机浏览器(鸿蒙浏览器 / iOS Safari PWA)      │
│  React 18 + TS + Vite + Tailwind + PWA       │
│  (静态文件托管在 Cloudflare Pages)            │
└──────────────┬──────────────────────────────┘
               │ HTTPS (supabase-js, anon key)
┌──────────────▼──────────────────────────────┐
│  Supabase 免费版(唯一后端,不写服务器代码)     │
│  ├─ Auth      邮箱+密码                      │
│  ├─ Postgres  4 张表 + RLS + 2 个 RPC 函数   │
│  ├─ Realtime  订阅 messages 新增行           │
│  └─ Storage   私有 bucket: chat-images       │
└─────────────────────────────────────────────┘
```

核心原则:

- **服务端数据库是唯一事实来源**。Realtime 只是"加速通知",所有关键路径都有"主动拉取"兜底。
- **安全全靠 RLS**:前端只持有 anon key,任何人拿到前端代码也只能读写自己 couple 的数据。
- **不写 Edge Functions**;仅有的两处"需要提权"的逻辑(注册建档、凭邀请码加入小屋)用 Postgres `security definer` 函数解决。

---

## 2. 路由与页面流转

```
未登录 ──────────────► /login   登录/注册(同页切换)
已登录但未配对 ──────► /pair    创建小屋(得邀请码) / 输入邀请码加入
已登录且已配对 ──────► 主界面(底部 Tab)
                        ├─ /        聊天(默认页)
                        ├─ /ledger  记账
                        └─ /us      我们(设置)
```

- 用一个 `<RequireAuth>` + `<RequireCouple>` 路由守卫组件实现自动跳转。
- 配对状态变化(对方加入小屋)由 /pair 页轮询或 Realtime 感知,自动进入主界面。

### 2.1 页面线框(390px 竖屏基准)

**聊天页 `/`**

```
┌────────────────────────┐
│  ❤ 双人小屋        (对方在线状态可后加)
├────────────────────────┤
│        ─ 6月10日 14:32 ─        ← 间隔>5分钟显示时间条
│  (头像) ┌──────────┐
│         │ 对方消息   │           ← 左侧白色气泡
│         └──────────┘
│            ┌──────────┐ 
│            │ 我的消息   │ ✓      ← 右侧主题色气泡
│            └──────────┘
│            ┌──────────┐
│            │ 发送失败   │ ⟳点击重试
│            └──────────┘
├────────────────────────┤
│ [📷] [输入框…………] [发送] │
├────────────────────────┤
│  💬聊天   📒记账   👫我们  │ ← 底部Tab + safe-area
└────────────────────────┘
```

**记账页 `/ledger`**

```
┌────────────────────────┐
│  ◀  2026年6月  ▶        ← 月份切换
│ ┌────────────────────┐ │
│ │ 本月共支出 ¥1,234.50 │ │
│ │ 我 ¥800 ▓▓▓▓▓░░ 她 ¥434│ ← 双方对比条
│ │ 餐饮40% 交通20% …    │ │ ← 分类占比(纯SVG)
│ └────────────────────┘ │
│  6月10日                │
│   🍜 餐饮  午饭   我 ¥32 │ ← 按日分组的流水
│   🚇 交通  地铁   她 ¥6  │
│  6月9日                 │
│   …                    │
│                  (＋记一笔)← 右下角悬浮按钮
└────────────────────────┘
```

「记一笔」为底部弹层(bottom sheet):金额数字键盘 → 分类六宫格(餐饮/交通/购物/娱乐/日用/其他) → 付款人(默认自己) → 日期(默认今天) → 备注(选填) → 保存。

**我们页 `/us`**

```
┌────────────────────────┐
│   (我的头像)  ❤  (TA头像) │
│    昵称A          昵称B  │
│   「在一起的第 N 天」      │ ← 可后续加纪念日功能
├────────────────────────┤
│  ✏ 修改昵称/头像          │
│  🔮 (预留:未来功能入口)    │
│  🚪 退出登录              │
└────────────────────────┘
```

### 2.2 视觉规范

- 主题色:暖粉 `rose-400 (#FB7185)`,背景 `#FFF8F7`,圆角偏大(`rounded-2xl`),整体温馨简洁。
- 内容区 `max-w-md mx-auto`,桌面浏览器打开也不至于太难看。
- 全局处理 iPhone 安全区:`padding-bottom: env(safe-area-inset-bottom)` 用于底部 Tab 与聊天输入栏;`viewport-fit=cover`。
- 所有 UI 文案中文;字体直接用系统字体栈,不引入 webfont(省流量)。

---

## 3. 数据库设计(在 CLAUDE.md 表结构基础上的补充)

四张表(`profiles / couples / messages / expenses`)的字段以 CLAUDE.md 第 6 节为准,此处不重复。以下是落地所需的补充设计,M1 时整理成可直接执行的迁移 SQL。

### 3.1 两个 security definer RPC(替代后端)

普通 RLS 覆盖不了两个动作,各用一个数据库函数解决:

1. **`handle_new_user()` 触发器**:`auth.users` 新增时自动插入 `profiles`,昵称取注册时传的 `raw_user_meta_data->>'display_name'`。避免前端"注册成功但建档失败"的中间态。
2. **`join_couple_by_code(code text)`**:加入者此时还不是 couple 成员,RLS 下无权 update 那行 couples;该函数校验邀请码存在、`member_b` 为空、自己不是 `member_a`,然后写入 `member_b` 并返回 couple 记录。

创建小屋则不需要提权:`create_couple` 可以直接 insert(RLS 允许 `member_a = auth.uid()` 的 insert),邀请码在数据库端默认值里生成 6 位大写字母数字(排除易混淆的 0/O/1/I),撞 unique 约束就重试一次。

### 3.2 RLS 策略矩阵

先建辅助函数 `is_couple_member(cid uuid) returns boolean`(security definer,查 couples 表判断 `auth.uid()` 是否为 member_a/member_b),所有策略复用:

| 表 | select | insert | update | delete |
|---|---|---|---|---|
| profiles | 自己 + 同 couple 的对方 | 仅触发器写入 | 仅本人 | 不开放 |
| couples | 自己是成员的行;**凭邀请码查询走 RPC,不开放给匿名 select** | `member_a = auth.uid()` 且 `member_b is null` | 仅走 `join_couple_by_code` | 不开放 |
| messages | `is_couple_member(couple_id)` | 同左 **且** `sender_id = auth.uid()` | 不开放(消息不可改) | 不开放(v1 不做撤回) |
| expenses | `is_couple_member(couple_id)` | 同左 **且** `payer_id = auth.uid()` | 记录人本人可改 | 记录人本人可删 |

> 注:expenses 的 update/delete 限"payer 本人",方便记错了修改;messages 一律只增不改,保持简单。

### 3.3 Realtime 与索引

- `alter publication supabase_realtime add table messages;` 只对 messages 开实时,expenses 用"操作后刷新"即可(记账不需要毫秒级同步)。
- 索引:`messages(couple_id, id desc)` 用于分页和增量补拉;`expenses(couple_id, spent_at)` 用于按月查询。

### 3.4 Storage

- 私有 bucket `chat-images`,路径约定 `{couple_id}/{uuid}.jpg`。
- Storage RLS:上传和读取都要求 `is_couple_member(路径第一段::uuid)`。
- 前端上传前用 canvas 压缩:最长边 ≤1280px、JPEG 质量 0.8(1GB 免费额度,单张控制在 ~200KB)。
- 显示用 `createSignedUrl`(有效期 1 小时),前端按路径缓存 signed URL 避免重复请求。

---

## 4. 前端设计

### 4.1 目录结构(细化 CLAUDE.md 第 7 节)

```
src/
  lib/
    supabase.ts          # 客户端单例;fetch 包 10s 超时
    retry.ts             # 指数退避重试工具(1s/2s/4s,最多3次)
    image.ts             # canvas 压缩图片
  hooks/
    useAuth.ts           # session + profile,登录/注册/登出
    useCouple.ts         # couple 记录 + 对方 profile
    useMessages.ts       # 分页 + Realtime + 补拉 + 发送队列(核心,见4.3)
    useExpenses.ts       # 按月查询 + 汇总计算 + 增删改
  contexts/
    AuthContext.tsx      # 全局提供 auth/couple 状态(只用 Context,不引状态库)
  pages/
    Login.tsx  Pair.tsx  Chat.tsx  Ledger.tsx  Us.tsx
  components/
    TabBar.tsx           # 底部导航(含 safe-area)
    MessageBubble.tsx    # 气泡(文本/图片/发送状态)
    ExpenseForm.tsx      # 记一笔底部弹层
    MonthSummary.tsx     # 月度汇总卡片(纯 SVG 图)
    Guard.tsx            # RequireAuth / RequireCouple 路由守卫
  types/
    db.ts                # 表行类型 + 本地消息状态类型
```

状态管理只用 **React Context + hooks**,不引入 Redux/Zustand 等额外依赖。

### 4.2 数据流:聊天(含弱网容错,对应 CLAUDE.md 第 10 节硬性要求)

```
                    ┌──────────────────────────────┐
                    │  服务端 messages 表(唯一事实) │
                    └──────┬──────────────┬────────┘
                 Realtime 推送(尽力而为)   增量补拉(兜底,必达)
                           │              │ where id > lastSeenId
                    ┌──────▼──────────────▼────────┐
                    │  前端消息列表(按 id 排序去重)  │
                    │  + 本地待发队列(sending/failed)│
                    └──────────────────────────────┘
```

- **首次进入**:按 `id desc` 拉最近 50 条;向上滚动翻页(`lt` 游标分页)。
- **lastSeenId**:本地记录已见最大 message id(localStorage 持久化)。以下时机触发增量补拉:① Realtime channel 重连成功;② `visibilitychange` 回到前台;③ `online` 事件。拉回的消息与 Realtime 推来的按 id 去重合并。
- **发送(乐观更新)**:点发送 → 本地立刻插入临时消息(负数临时 id,状态 `sending`)→ insert 成功后用服务端返回的真实行替换;失败(超时/网络错)→ 标记 `failed`,气泡上显示"⟳ 点击重试",**绝不静默丢弃**。重试沿用指数退避。
- **图片消息**:选图 → 压缩 → 占位气泡(本地预览 + 上传进度)→ Storage 上传 → insert 消息(content=路径)。上传失败同样进入失败重试态。
- **超时**:supabase.ts 里给 fetch 统一包 10s AbortController 超时,杜绝无限转圈。

### 4.3 数据流:记账

- 按 `spent_at` 所在月查询当月全部流水(两人一个月几十条,无分页压力),前端内存里算汇总:总额、双方各付、6 类占比。
- 新增/修改/删除后直接重新拉当月数据(简单可靠,不做本地缓存一致性)。
- 不开 Realtime;但页面 `visibilitychange` 回前台时刷新一次,保证看到对方新记的账。
- 图表不引入库:双方对比用 Tailwind 宽度百分比条,分类占比用一段手写 SVG(环形或横条)。

### 4.4 PWA 策略

- `vite-plugin-pwa`:`registerType: 'autoUpdate'`;manifest 中文名称「双人小屋」、主题色、竖屏 `portrait`、`display: standalone`。
- **缓存策略保守**:precache 只缓存构建产物(App Shell);Supabase API 请求一律 NetworkOnly,**不缓存数据**(iOS 存储配额不可靠,数据以服务端为准,符合 CLAUDE.md 风险节)。
- 图标 192/512 + iOS `apple-touch-icon`;M4 做「添加到主屏幕」引导页(检测 `display-mode: browser` 时在 /us 显示引导)。
- iOS 16.4+ Web Push 列为 M4 可选项,做不成不影响核心功能。

---

## 5. 关键流程

### 5.1 注册与配对

```
A 注册(填昵称) ─触发器建 profile─► A 登录 ─► /pair 选「创建小屋」
   ─► insert couples(得 6 位邀请码,界面大字展示,可一键复制) ─► 等待页

B 注册 ─► /pair 选「我有邀请码」─► 输入 6 位码
   ─► rpc join_couple_by_code() ─► 成功 ─► 双方进入主界面
        (A 的等待页通过订阅自己 couple 行的 UPDATE 或轮询感知配对完成)
```

### 5.2 异常路径约定

- 邀请码错误/小屋已满/给自己的小屋发码:RPC 返回明确错误码,前端弹中文提示。
- 登录态过期:supabase-js 自动刷新 token;刷新失败则跳 /login,**不清除**本地待发消息队列。
- Supabase 免费项目休眠(7 天不活跃):请求全部失败时展示全屏友好提示"小屋暂时连不上,稍后再试"而非白屏。

---

## 6. 里程碑任务拆解与验收标准

| 里程碑 | 主要任务 | 验收标准(真机) |
|---|---|---|
| **M0 初始化** | 脚手架 + Tailwind + 路由 + PWA 插件;三个空页面 + 底部 Tab;部署到 Cloudflare Pages | 两台手机都能打开 pages.dev 链接,Tab 可切换,iPhone 可添加到主屏幕全屏打开;**顺带验证国内可达性** |
| **M1 登录配对** | 建表 + RLS + 触发器 + RPC(交付迁移 SQL);登录/注册页;创建小屋/邀请码加入 | 两台手机各注册一个号,A 建小屋、B 凭码加入,双方都进入主界面;换号登录无法看到对方数据 |
| **M2 聊天** | 文本消息收发 + Realtime + 时间分组 UI;弱网容错(补拉/重试队列);然后图片消息 | 两台手机互发消息秒到;一台开飞行模式发消息→显示失败→恢复网络点重试成功;杀掉 app 重开不丢消息 |
| **M3 记账** | 记一笔表单、按日流水、月度汇总与简单图表、月份切换 | 双方各记几笔,两边看到同一本账,汇总数字正确;可修改/删除自己记的账 |
| **M4 PWA 收尾** | 图标/启动画面/添加引导页;(可选)iOS Web Push | iPhone 主屏图标与启动画面正常;(可选)锁屏收到新消息推送 |

---

## 7. 设计中已做的几个取舍(如不同意请指出)

1. **配对加入走数据库 RPC** 而不是放宽 couples 表 RLS——避免邀请码被枚举遍历,这是整个系统唯一的"准公开"入口,收紧处理。
2. **messages 不可改不可删**(v1 不做撤回),换取同步逻辑简单可靠。
3. **expenses 不开 Realtime**,回前台刷新即可,降低 Realtime 连接负担。
4. **PWA 不缓存业务数据**,离线时只保证界面壳能打开 + 待发队列不丢,数据一律以服务端为准。
5. **不引入任何图表库/状态库**,汇总图用纯 SVG 手写,状态用 Context + hooks。
