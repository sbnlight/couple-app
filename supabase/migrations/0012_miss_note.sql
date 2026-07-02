-- ============================================================
-- 迁移 0012(P3 异地互动):给「想你」加可选留言 + 表情
-- 用途:想你按钮从纯计数升级为可附一句话/一个表情的思念卡片。
-- 用法:Supabase 控制台 → SQL Editor → 新建查询 → 整段粘贴 → Run。
-- 幂等:全部 if not exists,可重复执行。
-- ============================================================

alter table if exists public.misses
  add column if not exists note text;
alter table if exists public.misses
  add column if not exists emoji text;
