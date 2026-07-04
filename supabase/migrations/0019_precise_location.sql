-- ============================================================
-- 迁移 0019:精确位置(具体城市,而非按时区就近的代表城市)
-- 用途:双城卡片/名片以前按时区映射到代表城市(如整个美西时区都显示"洛杉矶")。
--   这里给每人存一个可精确到城市的位置:city 显示名 + 经纬度(天气/距离用)。
--   位置共享(对方能看到你所在城市);未设置则回退按时区显示(旧行为)。
-- 时间仍按时区显示(同一时区内城市时间相同),本迁移不影响时间。
-- 用法:Supabase 控制台 → SQL Editor → 粘贴 → Run。幂等,可重复执行。
-- ============================================================

alter table if exists public.profiles
  add column if not exists city text;
alter table if exists public.profiles
  add column if not exists lat double precision;
alter table if exists public.profiles
  add column if not exists lng double precision;

-- 让 PostgREST 立刻重载 schema 缓存
notify pgrst, 'reload schema';
