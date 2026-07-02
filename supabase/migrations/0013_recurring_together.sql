-- ============================================================
-- 迁移 0013(P4 仪式感):纪念日年度轮回 + 恋爱纪念日锚点
-- 用途:
--   1) anniversaries.recurring:标记"每年重复"(生日/周年),到期后自动倒计下一年
--   2) couples.together_date:你们在一起的日期,用于「在一起 N 天」大卡计数
-- 用法:Supabase 控制台 → SQL Editor → 新建查询 → 整段粘贴 → Run。
-- 幂等:if not exists,可重复执行。
-- ============================================================

-- 1) 纪念日是否年度重复
alter table if exists public.anniversaries
  add column if not exists recurring boolean not null default false;

-- 2) 在一起的日期(恋爱计数大卡)。走列级授权,成员可改,邀请码/成员字段仍受保护。
alter table if exists public.couples
  add column if not exists together_date date;
grant update (together_date) on table public.couples to authenticated;
