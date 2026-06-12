# 协作指南 · 两个人一起改「双人小屋」

> 这份文档给一起维护本仓库的两个人看。目标:两人都能安全地改代码、
> 互不覆盖、也不会把「线上正在用的 App」搞坏。

## 角色与账号(重要:两类账号别混)

- **Claude Code 账号**(AI 助手):两人可共用同一个 Anthropic/Max 账号登录。
  它只是「写代码的大脑」,和 GitHub 身份无关。
- **GitHub 账号**(代码权限):**每人用自己的 GitHub 账号**。仓库所有者在
  Settings → Collaborators 把对方加为协作者后,双方都能 clone / push。

> ⚠️ 在中国大陆:GitHub 一般可直连(偶尔慢);但 **Claude Code 必须挂稳定
> 梯子**才能连上 Anthropic 服务器,否则无法使用。

## 一次性环境搭建(在自己的电脑上)

1. 安装 [Node.js](https://nodejs.org)(LTS 版即可)。
2. 安装 Claude Code,用共用的 Anthropic 账号登录(中国需梯子)。
3. 用**自己的** GitHub 账号配置 git(Claude Code 会引导,或用 GitHub Desktop)。
4. 克隆仓库并安装依赖:
   ```bash
   git clone https://github.com/sbnlight/couple-app.git
   cd couple-app
   npm install
   ```
5. 本地预览(可选):复制 `.env.example` 为 `.env.local` 填入 Supabase 配置后
   `npm run dev`。不填也能跑,只是会显示「未配置环境变量」。

## 日常工作流(每次改东西都照这个走)

```
① 开工前先拉最新        git pull
② 切到自己的分支        git checkout dev-你的名字   (第一次用 git checkout -b)
③ 改代码 / 让 Claude 改
④ 改完务必本地构建一次  npm run build      ← 必须通过,别跳过
⑤ 提交并推送           git add -A && git commit -m "说明" && git push
⑥ 想上线时合并到 master(见下)
```

> 这些 git 命令各自的 Claude Code 会自动帮你执行,不用背。

## 黄金规则(避免吵架和事故)

1. **各用各的分支**:一人 `dev-a`、一人 `dev-b`,永远不要两个人同时直接改
   `master`,否则会互相覆盖。
2. **开工前先 `git pull`**:拿到对方最新的改动,减少冲突。
3. **`npm run build` 通过后才合并到 master**。master 一更新,Cloudflare 就把
   它部署成你们每天在用的线上 App——别把没调好的东西推上去。
4. **每个分支都有独立预览网址**:推到 `dev-b` 后,Cloudflare 自动生成一个
   单独的 `xxx.couple-app-xxx.pages.dev` 链接,先在那上面真机测试,确认 OK
   再合并 master。这样线上正式版永远是稳的。

## 合并到 master 的两种方式

- **省事版**:在本地 `git checkout master && git merge dev-b && git push`,
  前提是 build 通过。
- **稳妥版**:在 GitHub 上对自己的分支发起 Pull Request,对方看一眼再点合并;
  适合改动较大、想让对方过目时。

## 数据库 / 后端改动注意

- 改 UI、改前端逻辑:推代码即可,互不影响。
- 涉及数据库表结构:要新增 `supabase/migrations/` 下的编号迁移 SQL,并由
  **其中一人**在 Supabase 控制台执行一次(数据库是两人共享的同一个)。
- Edge Function(`supabase/functions/push`)改了之后,需手动在 Supabase 控制台
  重新部署——它不会随 GitHub 自动更新。
