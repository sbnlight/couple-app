-- ============================================================
-- 迁移 0020:默契问答加「留言」
-- 用途:选完选项后可写一句选它的原因/悄悄话,存在自己的 quiz_answers 行;
--   和选项一样,双方都答完后才互相可见(揭晓在客户端做)。
-- 用法:Supabase 控制台 → SQL Editor → 粘贴 → Run。幂等,可重复执行。
-- ============================================================

alter table if exists public.quiz_answers
  add column if not exists note text;

notify pgrst, 'reload schema';
