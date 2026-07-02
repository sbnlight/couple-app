-- ============================================================
-- 迁移 0016:气泡/字体改为"双方共享"
-- 用途:每个人选的气泡样式与字体存到自己的 profile,这样两台手机都能看到
--   "每条消息按其发送者的选择显示"(你的消息用你选的,TA 的用 TA 选的)。
-- 用法:Supabase 控制台 → SQL Editor → 整段粘贴 → Run。可重复执行。
-- 幂等:add column if not exists,纯加列,不动现有数据。
-- ============================================================

alter table if exists public.profiles
  add column if not exists bubble_id text;
alter table if exists public.profiles
  add column if not exists bubble_font text;
