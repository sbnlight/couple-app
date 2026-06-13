-- ============================================================
-- 迁移 0011:补齐缺失的列(幂等,重复执行也安全)
-- 用途:之前 0006 / 0009 若没完整执行,会缺少下面这几列,导致:
--   · 功能开关(每日打卡/想你)一点就「保存失败」  → 缺 couples.feature_flags
--   · 看不到对方所在时区的时间                      → 缺 profiles.timezone
--   · 每日一问发图报错                              → 缺 daily_answers.image_paths
-- 用法:Supabase 控制台 → SQL Editor → 新建查询 → 整段粘贴 → Run。
-- 全部用 "if exists / if not exists",跑多少次都不会报错。
-- ============================================================

-- 1) 功能开关(每日一问/打卡/想你 的开关,小屋级共享)
alter table if exists public.couples
  add column if not exists feature_flags jsonb not null default '{}'::jsonb;
grant update (feature_flags) on table public.couples to authenticated;

-- 2) 个人时区(App 打开时自动写入,用于显示对方当地时间)
alter table if exists public.profiles
  add column if not exists timezone text;

-- 3) 每日一问的多图回答(最多 9 张图片路径)
alter table if exists public.daily_answers
  add column if not exists image_paths text[];
