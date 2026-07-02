# 双人小屋 💕

一个**只供两个人使用**的情侣专属 PWA:实时聊天、共同记账、异地互动小功能。
全程 **0 成本**部署(Supabase 免费版 + Cloudflare Pages 免费版),无自建服务器。

> 每对情侣部署**自己的一套**:你的数据库只属于你们两个人,与其他使用者完全隔离。

## 功能

- 💬 **聊天**:实时收发、图片、语音、GIF/自定义表情包、拍一拍、引用回复、撤回、已读回执、历史搜索;弱网容错(断线增量补拉、失败重试队列、待发媒体本地持久化、幂等防重复)
- 📒 **记账**:共同账本、多货币、收入/支出、共同/个人、月度汇总与分类占比、**AA 欠款结算**、**月度预算与超支提醒**、趋势图、年度报告
- 👫 **我们**:对方当地时间、**双城卡片(两地时间/天气/距离)**、见面倒数日、**纪念日(支持生日/周年年度轮回)**、**在一起 N 天大卡**、每日一问、**默契双人问答**、想你(可带悄悄话)、每日打卡连胜、**爱情树养成**、愿望清单、定时开启的留言小纸条
- 💗 **异地专属**:**实时触碰**(双方同时按住屏幕的心 → 双端震动/发光,隔空触碰)
- 🔔 **推送通知**(可选):App 关闭时也能收到新消息提醒(iOS PWA 支持良好)
- 🎨 个性化:上百款气泡/背景、四套主题色、字体大小、深浅模式;开场动画
- 🛡️ 稳健:全局错误兜底(不白屏)、多语言(中/英/日)、iOS 安全区适配

## 技术栈

React 18 + TypeScript + Vite + Tailwind CSS + vite-plugin-pwa;
后端全部依赖 Supabase(Auth / Postgres+RLS / Realtime / Storage / Edge Functions)。
架构与设计细节见 [DESIGN.md](DESIGN.md),产品约定见 [CLAUDE.md](CLAUDE.md)。

## 自己部署一套(约 30 分钟)

### 1. 准备 Supabase(免费,无需绑卡)

1. 到 [supabase.com](https://supabase.com) 注册并 **New project**(Region 选离你们俩都近的);
2. **SQL Editor** 中,把 `supabase/migrations/` 目录下的所有 `.sql` 文件**按编号从小到大**逐个粘贴执行(每个文件执行一次);
3. **Authentication → Sign In / Providers → Email**:关闭 **Confirm email**(两人私用无需邮箱验证);
4. **Project Settings → API Keys**:记下 **Project URL** 和 **Publishable key**。

### 2. 部署前端(Cloudflare Pages,免费)

1. Fork 本仓库到你自己的 GitHub;
2. Cloudflare 控制台 → Workers & Pages → **创建 Pages 项目** → Connect to Git → 选你 fork 的仓库
   (注意走 **Pages** 流程,配置页应有「Build output directory」而不是「Deploy command」);
3. 构建配置:Framework preset 选 **React (Vite)**,Build command `npm run build`,输出目录 `dist`;
4. 项目 Settings → Environment variables 添加:
   - `VITE_SUPABASE_URL` = 你的 Project URL
   - `VITE_SUPABASE_ANON_KEY` = 你的 Publishable key
5. 部署完成后,两台手机打开你的 `*.pages.dev` 地址:注册两个账号 → 一方创建小屋拿邀请码 → 另一方凭码加入。
6. iPhone 用 Safari「添加到主屏幕」,安卓/鸿蒙用浏览器菜单「添加到桌面」,即可全屏使用。

### 3. 推送通知(可选,多 10 分钟)

1. 本地运行 `node scripts/gen-vapid.cjs` 生成三个值;
2. `VITE_VAPID_PUBLIC_KEY` 加入 Cloudflare 环境变量并重新部署;
3. Supabase → **Edge Functions** → 新建函数 `push`,粘贴 `supabase/functions/push/index.ts` 全部内容,
   部署后在函数设置里**关闭 Enforce JWT verification**;
4. Edge Functions → **Secrets** 添加:`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`PUSH_WEBHOOK_SECRET`
   (可选 `VAPID_SUBJECT` = `mailto:你的邮箱`);
5. **Integrations → Database Webhooks** → Enable → Create:表 `public.messages`、事件 Insert、
   类型 Supabase Edge Functions 选 `push`,HTTP Headers 加 `x-push-secret` = 你生成的密钥;
6. 两台手机在「我们」页开启「🔔 新消息通知」。
   (注:无 Google 服务的安卓机型自带浏览器可能不支持 Web Push;iOS 需 16.4+ 且从主屏幕图标打开。)

### 4. 强烈建议:注册完就关闭注册入口

两个账号都建好后:**Authentication → Sign In / Providers → 关闭 Allow new users to sign up**。
这样即使部署地址被别人知道,也无法注册占用你的免费额度;你们俩的登录使用不受影响。
同理,**不要公开传播你自己的部署地址**。

## 本地开发

```bash
cp .env.example .env.local   # 填入你的 Supabase 配置
npm install
npm run dev
```

## License

[MIT](LICENSE)
