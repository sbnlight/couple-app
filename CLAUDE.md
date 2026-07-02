# CLAUDE.md — 情侣专属应用「双人小屋」(项目代号,可改)

> 本文件是项目的最高上下文。每次会话开始时请先通读本文件;任何与本文件冲突的实现方式,先与我确认再动手。

## 1. 项目背景与目标

这是一个**只供两个人使用**的私人应用:我和我女朋友。不对外发布、不上架任何应用商店、不做用户增长。

- **核心功能 v1**:① 双人实时聊天;② 共同记账(两人共享一本账)。
- **未来可能扩展**:纪念日提醒、每日打卡、愿望清单、照片墙等。架构设计要方便日后加这类"双人共享数据"的小功能。
- **使用设备**:
  - 我:华为手机(鸿蒙系统),通过浏览器使用,添加到桌面。
  - 她:iPhone,通过 Safari 使用,"添加到主屏幕"作为 PWA 运行。
- **开发者背景**:AI 方向研究生,有编程基础,但前端/全栈经验有限。解释和注释请适当详细,用中文。

## 2. 硬性约束(不可违反)

1. **全程 0 成本**:只使用各服务的免费额度。引入任何新依赖、新服务前,先确认免费且无需绑卡;若某方案必须付费,先停下来询问我。
2. **不自建服务器、不写独立后端**:后端能力全部依赖 Supabase 免费版(Auth + Postgres + Realtime + Storage)。尽量用数据库 + RLS 解决问题,非必要不写 Edge Functions。
3. **形态是 PWA 网页应用**,不是原生 App。不引入 React Native / Flutter / 小程序方案。
4. **隐私**:这是私人应用,前端代码中绝不出现 service_role key;`.env` 不提交到 git;`.gitignore` 必须覆盖所有密钥文件。

## 3. 技术栈(已确定)

| 层 | 选型 | 说明 |
|---|---|---|
| 前端框架 | React 18 + TypeScript + Vite | |
| 样式 | Tailwind CSS | 移动优先 |
| PWA | vite-plugin-pwa | manifest + service worker |
| 路由 | react-router-dom | |
| 后端 | Supabase 免费版 | Auth / Postgres / Realtime / Storage |
| 部署 | Cloudflare Pages(备选 Vercel / Netlify) | 静态托管,免费 |

环境变量(放在 `.env.local`,不提交):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## 4. 产品形态与页面结构

移动端竖屏优先(约 390px 宽为基准),底部 Tab 导航:

1. **聊天**(默认页):消息流 + 输入框,支持文本和图片消息。
2. **记账**:本月支出总览(双方各付了多少、分类占比)+ 流水列表 +「记一笔」按钮。
3. **我们**(设置页):双方头像昵称、配对状态、退出登录;未来新功能的入口也放这里。

设计要求:适配 iPhone 安全区(`env(safe-area-inset-*)`);界面温馨简洁,不堆砌功能;所有 UI 文案用中文。

## 5. 账号与配对模型

- 使用 Supabase Auth 邮箱 + 密码注册登录(免费版自带)。
- **配对流程**:先注册的一方创建"小屋"并获得 6 位邀请码 → 另一方注册后输入邀请码加入 → 配对完成,couples 记录上限两名成员。
- 整个系统只服务这一对 couple,但表结构仍带 `couple_id`,保持通用性。

## 6. 数据模型(Postgres / Supabase)

```sql
-- 用户资料(与 auth.users 一一对应)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

-- 情侣"小屋",一对一条记录
create table couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  member_a uuid not null references profiles(id),
  member_b uuid references profiles(id),  -- 第二人加入前为 null
  created_at timestamptz default now()
);

-- 聊天消息
create table messages (
  id bigint generated always as identity primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  type text not null default 'text' check (type in ('text','image')),
  content text not null,  -- 文本内容,或 Storage 图片路径
  created_at timestamptz default now()
);

-- 账目流水
create table expenses (
  id bigint generated always as identity primary key,
  couple_id uuid not null references couples(id) on delete cascade,
  payer_id uuid not null references profiles(id),
  amount numeric(10,2) not null check (amount > 0),
  category text not null,  -- 餐饮/交通/购物/娱乐/日用/其他
  note text,
  spent_at date not null default current_date,
  created_at timestamptz default now()
);
```

**安全(RLS)原则**:所有表开启 Row Level Security。核心规则:**只有该 couple 的两名成员能读写带其 `couple_id` 的行**;messages 与 expenses 的 insert 还需校验 `sender_id / payer_id = auth.uid()`。建议先建一个 `is_couple_member(couple_id uuid)` 的 security definer 辅助函数,各表策略复用它。

**实时**:为 `messages` 表开启 Realtime(加入 `supabase_realtime` publication),前端用 `postgres_changes` 订阅新消息。

**图片消息**:存 Supabase Storage,bucket 设为私有,访问用 signed URL;上传前在前端压缩(免费版存储 1GB,够用但别浪费)。

## 7. 目录结构约定

```
src/
  lib/          # supabase 单例、storage(签名URL)、image(压缩/extFromType)、
                # pendingStore(待发媒体 IndexedDB)、live(Realtime 广播/在场)、
                # effects(全屏特效)、weather、time(共用换日时区)、prefs、i18n、
                # questions(每日一问题库)、quizzes(默契问答题库)
  contexts/     # AuthContext(登录+配对+全局状态,对外 useAuth();无独立 useCouple)
  hooks/        # useMessages / useExpenses / useAnniversaries / useReadStatus / useStickers
  pages/        # Chat / Ledger / Us / Login / Pair / ResetPassword
  components/   # 通用组件 + 页面级面板(DailyQA / WishList / NotesPage / YearReport /
                # MindQuiz / Thumbkiss / TwoCityCard / LoveTree / MomentsCard 等)
  types/        # 数据库类型定义(types/db.ts)
```

> 说明:实际用 **`contexts/AuthContext`(`useAuth()`)** 承载登录+配对全局状态,没有单独的 `useCouple`;
> 部分"页面级面板"(如每日一问、愿望清单、默契问答)放在 `components/` 而非 `pages/`,以全屏覆盖层形式从「我们」页打开。

### 现有功能(已远超 v1,截至迁移 0014)
- **聊天**:文/图/语音/表情包(保留 GIF 动图、PNG 透明)/拍一拍/引用回复/撤回(2 分钟,撤回删 Storage 文件)/已读回执/搜索定位;弱网:服务端为准 + Realtime 通知 + catchUp 增量续拉 + 待发落 IndexedDB 可重试。
- **记账**:多币种、收支、共同/个人、月度汇总、AA 结算、月度预算(存 `feature_flags`)、分类/趋势图、年度报告。
- **我们(异地互动包)**:今日心情、对方当地时钟、**双城卡片**(两地时间/天气/距离)、**实时触碰 Thumbkiss**、见面倒数、**纪念日(支持年度轮回)**、**恋爱计数大卡**(`couples.together_date`)、每日一问(答完才可见对方,服务端 RLS 强制)、**默契双人问答**、想你(可带留言+表情)、每日打卡(连胜里程碑)、**爱情树**养成、愿望清单(恋爱清单模板)、定时解锁纸条、功能开关、外观设置、Web Push。
- **全局**:`ErrorBoundary` 兜底防白屏;PWA + iOS 安全区/启动图;i18n(中/英/日)。

### 迁移清单(supabase/migrations/,均幂等)
`0001` 认证配对 · `0002` 小屋/资料/设置 · `0003` 聊天 · `0004` 聊天扩展 · `0005` 记账 v2 · `0006` 双人互动(anniversaries/daily_answers/misses/checkins/wishes/notes)· `0007` push · `0008` 撤回 · `0009` feature_flags · `0010` 语音/拍一拍/心情 · `0011` 补列兜底 · `0012` 想你 note/emoji · `0013` 纪念日 recurring + couples.together_date · `0014` quiz_answers(默契问答)· `0015` 补齐 0013/0014(幂等)· `0016` profiles.bubble_id/bubble_font(气泡/字体共享)。

**气泡/字体共享(0016 起)**:每个人选的聊天气泡样式与字体存在自己的 `profiles.bubble_id`/`bubble_font`(而非仅本机),聊天里**每条消息按其发送者的选择渲染**——你的消息用你选的、TA 的用 TA 选的,两人看到一致。选择时同时写本机缓存(即时生效)与 profile(共享);对方的变更在重开/回前台刷新时可见。聊天背景仍是纯本机偏好。

## 8. 开发路线(按里程碑推进,每个里程碑结束都要能跑)

- **M0 初始化**:Vite + React + TS 脚手架,Tailwind、路由、PWA 插件配好;空页面 + 底部导航;能 `npm run dev` 跑通,并完成一次 Cloudflare Pages 部署验证。
- **M1 登录与配对**:Supabase 项目接入,注册/登录页,建表 + RLS,创建小屋/邀请码配对流程。
- **M2 聊天**:消息收发 + Realtime 订阅 + 聊天 UI(气泡左右分边、时间分组);然后加图片消息。
- **M3 记账**:记一笔表单、流水列表、月度汇总(双方支出对比 + 分类统计,可用简单图表)。
- **M4 PWA 收尾**:图标、启动画面、"添加到主屏幕"引导页;(可选)iOS 16.4+ Web Push 推送新消息提醒。

一次只做一个里程碑;完成后停下来让我真机测试,确认后再进入下一个。

## 9. 已知风险与注意事项

- **国内访问稳定性**:Supabase(`*.supabase.co`)和 Cloudflare Pages(`*.pages.dev`)在国内可达性看地区和运营商。M0/M1 完成后必须尽早用两台真机实测;若不稳定,备选 Vercel / Netlify 托管,或日后再考虑低成本域名方案(需我确认,涉及花钱)。
- **Supabase 免费项目闲置 7 天会被暂停**,需到控制台手动恢复。日常使用不会触发,但长假不用时要有心理预期。
- **iOS 限制**:Web Push 仅在"添加到主屏幕"后可用;Safari 对 PWA 的存储有配额限制,重要数据一律以服务端为准,前端只做缓存。
- **免费额度红线**:数据库 500MB、存储 1GB、月活/带宽限制。两人使用远碰不到,但写代码时仍保持节制(分页加载消息、图片压缩后上传)。

## 10. 协作约定(给 Claude Code)

- 用中文交流,代码注释用中文。
- 改动前先简述方案;涉及数据库 schema 变更时,给出可直接在 Supabase SQL Editor 执行的迁移 SQL。
- 不要擅自重构已确认的代码结构;不要引入本文件未列出的重量级依赖(轻量工具库可先问)。
- 每个功能完成后,告诉我如何在手机上验证。

### 发布流程(重要:一律先预览,再上线)
- **不要把功能改动直接提交/推送到 `master`**。`master` 一更新,Cloudflare 立即部署成两人每天在用的线上 App。
- 标准做法:在 **dev 分支**(我用 `dev-a`,女朋友用 `dev-b`)上改 → `npm run build` 通过 → push 该分支 → Cloudflare 自动生成**独立预览链接**(`dev-a.<项目>.pages.dev`)→ **把预览链接交给我,我确认满意后,才合并到 `master` 上线**。
- Cloudflare 的 **Preview 环境变量已配置完成**,预览链接能正常连数据库、可真机体验。
- 仅在我**明确说「直接上线 / 推 master」**,或紧急修复线上故障时,才跳过预览直接推 master。
- 合并上线:`git checkout master && git merge dev-x && git push`(build 通过的前提下),随后切回 dev 分支继续。

### 弱网容错(必须实现,针对大陆网络环境)
- 消息以服务端数据库为唯一事实来源;Realtime 推送只是通知,不可依赖其必达。
- 客户端记录本地已见的最新 message id;每次重连、app 回到前台时,按该 id 增量补拉错过的消息。
- 发送失败的消息进入本地重试队列,UI 标记"发送中/失败,点击重试",不静默丢弃。
- 所有网络请求设置超时(如 10s)与指数退避重试,避免界面无限转圈。