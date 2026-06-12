# 两个人一起改「双人小屋」· 完整协作指南

> 这份文档把「两个人怎么一起改这个 App」讲清楚:能不能一起改、怎么设置、
> 日常怎么操作、以及几个最容易困惑的问题。一个人单干时也可以看,大部分
> 规矩只在「两人同时改」时才需要。可以整份转发给对方或对方的 Claude Code。

---

## 一、能不能两个人一起改?——能,而且很简单

GitHub 天生就是为多人协作设计的。做法:仓库所有者在
**Settings → Collaborators → Add people** 把对方的 GitHub 账号加为协作者,
对方点邮件邀请接受后,双方就都能 clone(下载)、改、push(上传)同一个仓库。

> 不需要对方 fork、也不需要走繁琐的申请流程。两个人的私有项目,直接共享
> 读写权限最省事。

---

## 二、两类账号别搞混(很重要)

| | 作用 | 怎么用 |
|---|---|---|
| **Claude Code 账号** | 写代码的「AI 大脑」 | 两人可共用同一个 Anthropic / Max 账号登录;它和 GitHub 身份无关 |
| **GitHub 账号** | 代码权限与署名 | **每人用自己的 GitHub 账号**,被加为协作者后即可推送 |

一句话:对方电脑上 = **你的 Claude 大脑** + **她自己的 GitHub 手脚**。

### 中国大陆访问的现实
- **GitHub**:一般可以裸连(偶尔慢),git clone/pull/push 基本没问题。
- **Claude Code**:它要连 Anthropic 的服务器,而 Anthropic 在中国大陆**无法
  直连**,所以那台电脑**必须挂稳定的梯子/代理**才能用 Claude Code。这是能不能
  用的硬门槛,不是快慢问题。
- **共用账号小提醒**:Anthropic 订阅严格说是一人一号,两人同时登偶尔可能触发
  安全验证或互踢;情侣日常用通常没事,真频繁出问题就各自开号。

---

## 三、一次性环境搭建(在自己电脑上)

1. 安装 [Node.js](https://nodejs.org)(LTS 版)。
2. 安装 Claude Code,用共用的 Anthropic 账号登录(中国需梯子)。
3. 用**自己的** GitHub 账号配置 git(Claude Code 会引导,或用 GitHub Desktop)。
4. 克隆仓库并装依赖:
   ```bash
   git clone https://github.com/sbnlight/couple-app.git
   cd couple-app
   npm install
   ```
5. 让 Claude Code 先读一遍仓库里的 `CLAUDE.md`(项目规矩)和本文件,它就懂了。
6. (可选)本地预览:复制 `.env.example` 为 `.env.local` 填入 Supabase 配置后
   `npm run dev`。不填也能跑,只是显示「未配置环境变量」。

---

## 四、日常工作流(每次改东西都照这个走)

```
① 开工前先拉最新        git pull
② 切到自己的分支        git checkout dev-你的名字   (第一次加 -b)
③ 改代码 / 让 Claude 改
④ 改完务必本地构建一次  npm run build      ← 必须通过,别跳过
⑤ 提交并推送           git add -A && git commit -m "说明" && git push
⑥ 想上线时合并到 master(见第六节)
```

> 这些 git 命令各自的 Claude Code 会自动帮你执行,不用背。

---

## 五、黄金规则(避免吵架和事故)

1. **各用各的分支**:一人 `dev-a`、一人 `dev-b`,不要两人同时直接改 `master`。
2. **开工前先 `git pull`**:拿到对方最新改动,减少冲突。
3. **`npm run build` 通过后才合并到 master**。master 一更新,Cloudflare 就把它
   部署成你们每天在用的线上 App——别把没调好的东西推上去。
4. **每个分支都有独立预览网址**:推到 `dev-b` 后,Cloudflare 会自动生成一个单独
   的预览链接,先在那上面真机测试,确认 OK 再合并 master。线上正式版永远是稳的。

---

## 六、常见疑问解答(FAQ)

### Q1:我现在是在 master 分支上改吗?
用 `git branch` 看,前面带 `*` 的就是当前分支。**一个人单干时直接在 master 上改
完全没问题**;分支规矩是为「两个人同时改」准备的。

### Q2:如果我俩同时改,我先推到 master,她再推,会不会把我的覆盖掉?
**不会。git 专门防止这种「悄悄覆盖」。** 实际会发生的是:

- 你先 push 成功;她再 push 时,**git 直接拒绝她**(提示远程有她没有的提交),
  她必须先 `git pull` 把你的改动拉下来。拉的时候:
  - **改的是不同文件/不同地方** → git **自动合并**,两人的改动都保留,谁的都不丢;
  - **改了同一文件的同一行** → git 报「冲突」,把两个版本都列出来让人**手动选**,
    **仍然不会有谁的代码被悄悄吃掉**,只是要人决定一下(Claude Code 会帮忙处理)。

> 唯一能强行覆盖别人的是危险命令 `git push -f`(强推)——只要都不用它就绝对安全。

### Q3:那直接都推 master，和各用分支，区别到底是什么?
- **都推 master**:不会丢代码,但偶尔要处理「先拉再推」和冲突,略烦。
- **各用分支再合并**:更省心。分支的意义不是防丢代码(git 本来就防),而是:
  ① 平时互不干扰、少踩冲突;② 半成品隔离在自己分支+预览链接,不污染线上;
  ③ 合并时机由你们主动挑,而不是被动被 git 拦下。

### Q4:这些 git 操作我们要手动敲吗?
基本不用。拉、推、合并、解冲突,各自的 Claude Code 都能自动帮忙——你们主要负责
「想改什么」和「测好没」。

---

## 七、合并到 master 的两种方式

- **省事版**:本地 `git checkout master && git merge dev-b && git push`(build 通过的前提下)。
- **稳妥版**:在 GitHub 上对自己的分支发起 Pull Request,对方看一眼再点合并;
  适合改动较大、想让对方过目时。

---

## 八、数据库 / 后端改动的额外注意

- 改 UI、改前端逻辑:推代码即可,互不影响。
- 涉及数据库表结构:要新增 `supabase/migrations/` 下的编号迁移 SQL,并由**其中一人**
  在 Supabase 控制台执行一次(数据库是两人共享的同一个)。
- Edge Function(`supabase/functions/push`)改了之后,需手动在 Supabase 控制台
  重新部署——它不会随 GitHub 自动更新。

---

## 九、仓库所有者(先建项目的人)现在要做的

1. 让对方注册一个自己的 GitHub 账号,把用户名发来。
2. Settings → Collaborators → Add people → 填用户名 → 对方邮箱点接受。
3. 把本文件转发给对方,让她的 Claude Code 先读 `CLAUDE.md` + `COLLAB.md`。
