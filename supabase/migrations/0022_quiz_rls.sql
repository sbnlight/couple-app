-- ============================================================
-- 迁移 0022:默契问答「答完才可见对方」的服务端门槛(修偷看漏洞)
-- 背景:0014 的 quiz_answers_select 只校验 is_couple_member,导致对方的
--   选择与悄悄话在你作答前就下发到客户端(可被 DevTools/Network 偷看,
--   默契游戏被剧透、悄悄话泄露)。本迁移仿 0006 daily_answers 的
--   has_answered,加同款服务端门槛:自己答完同一天之前,看不到对方的行。
-- 用法:Supabase 控制台 → SQL Editor → 新建查询 → 整段粘贴 → Run。
-- 幂等:create or replace + drop/create policy,可重复执行。
-- ============================================================

-- 自己是否已回答某天的默契题(security definer 避免策略自引用递归)
create or replace function public.quiz_answered(cid uuid, qdate date)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from quiz_answers
    where couple_id = cid and quiz_date = qdate and user_id = auth.uid()
  );
$$;

-- 收紧 select:对方的答案(含悄悄话),自己答完同一天之前不可见
drop policy if exists "quiz_answers_select" on public.quiz_answers;
create policy "quiz_answers_select" on public.quiz_answers
  for select to authenticated
  using (
    is_couple_member(couple_id)
    and (user_id = auth.uid() or quiz_answered(couple_id, quiz_date))
  );

-- 让 PostgREST 立刻重载 schema/策略缓存
notify pgrst, 'reload schema';
