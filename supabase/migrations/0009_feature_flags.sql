-- ============================================================
-- 迁移 0009:互动功能开关 + 每日一问支持图片回答
-- 用法:在 Supabase 控制台 → SQL Editor 新建查询,整段粘贴执行一次。
-- ============================================================

-- ---------- 1. 功能开关(每日一问/打卡/想你 可开可关,双方同步) ----------

-- 小屋级共享:{"daily_qa": false} 表示关闭;缺省视为开启
alter table public.couples
  add column feature_flags jsonb not null default '{}'::jsonb;

-- 列级授权叠加(0002 放开了 name,0006 放开了 next_meet_date)
grant update (feature_flags) on table public.couples to authenticated;

-- ---------- 2. 每日一问:回答可附图片(最多 9 张) ----------

-- 图片存 chat-images 桶({couple_id}/qa-*.jpg),复用既有的成员级访问策略;
-- 这里只需在回答行上记路径数组。"答完才能看对方"的规则照常生效。
alter table public.daily_answers
  add column image_paths text[];
