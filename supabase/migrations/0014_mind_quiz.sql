-- ============================================================
-- 迁移 0014(P5 游戏化):默契双人问答
-- 用途:每天一道选择题,两人各选一项,都答完后揭晓是否默契。
-- 用法:Supabase 控制台 → SQL Editor → 新建查询 → 整段粘贴 → Run。
-- 幂等:create table if not exists + drop/create policy 前置判断。
-- ============================================================

create table if not exists public.quiz_answers (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  quiz_date date not null,
  quiz_id int not null,             -- 当天题目 id(前端题库索引)
  user_id uuid not null references public.profiles(id),
  choice int not null,              -- 所选选项的下标
  created_at timestamptz default now(),
  unique (couple_id, quiz_date, user_id)  -- 每人每天一题一答(可改答)
);

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
