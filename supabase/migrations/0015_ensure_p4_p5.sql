-- ============================================================
-- 迁移 0015:补齐 P4/P5 的列与表(防 0013/0014 未完整应用)
-- 背景:若"在一起的日子保存失败"、"默契大考验点选项没反应",多半是
--   couples.together_date 或 quiz_answers 没建好。本迁移把它们幂等补齐。
-- 用法:Supabase 控制台 → SQL Editor → 整段粘贴 → Run。可重复执行。
-- ============================================================

-- 1) 在一起的日子(恋爱计数大卡)+ 列级授权
alter table if exists public.couples
  add column if not exists together_date date;
grant update (together_date) on table public.couples to authenticated;

-- 2) 纪念日年度重复(以防 0013 未跑)
alter table if exists public.anniversaries
  add column if not exists recurring boolean not null default false;

-- 3) 默契双人问答表
create table if not exists public.quiz_answers (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  quiz_date date not null,
  quiz_id int not null,
  user_id uuid not null references public.profiles(id),
  choice int not null,
  created_at timestamptz default now()
);

-- 3a) 唯一约束(每人每天一答,支持 upsert 改答)。仅当表上还没有唯一约束时才加,
--     兼容"表已由 0014 建好"与"本次新建"两种情况。
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.quiz_answers'::regclass and contype = 'u'
  ) then
    alter table public.quiz_answers
      add constraint quiz_answers_uniq unique (couple_id, quiz_date, user_id);
  end if;
end $$;

-- 3b) RLS(幂等:先 drop 再 create)
alter table public.quiz_answers enable row level security;

drop policy if exists "quiz_answers_select" on public.quiz_answers;
create policy "quiz_answers_select" on public.quiz_answers
  for select to authenticated using (is_couple_member(couple_id));

drop policy if exists "quiz_answers_insert" on public.quiz_answers;
create policy "quiz_answers_insert" on public.quiz_answers
  for insert to authenticated
  with check (is_couple_member(couple_id) and user_id = auth.uid());

drop policy if exists "quiz_answers_update" on public.quiz_answers;
create policy "quiz_answers_update" on public.quiz_answers
  for update to authenticated
  using (user_id = auth.uid() and is_couple_member(couple_id))
  with check (user_id = auth.uid() and is_couple_member(couple_id));
