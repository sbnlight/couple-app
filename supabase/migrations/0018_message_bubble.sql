-- ============================================================
-- 迁移 0018:每条消息记录发送时的气泡样式/字体
-- 用途:让"改气泡不影响历史消息"——每条消息渲染时用它发送当时冻结的气泡,
--   而不是发送者当前选择;旧消息(无值)回退按发送者当前渲染。因为存在服务端,
--   两个人手机上看到的历史气泡完全一致。
-- 用法:Supabase 控制台 → SQL Editor → 新建查询 → 整段粘贴 → Run。
-- 幂等:add column if not exists,可重复执行。
-- ============================================================

alter table if exists public.messages
  add column if not exists bubble_id text;
alter table if exists public.messages
  add column if not exists bubble_font text;

-- 让 PostgREST 立刻重载 schema 缓存(新列立即可用)
notify pgrst, 'reload schema';
