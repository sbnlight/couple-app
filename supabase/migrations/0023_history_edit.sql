-- ============================================================
-- 迁移 0023:每日一问 / 默契问答 / 小纸条 —— 支持「随时编辑 + 改动提醒」
-- 背景:这三类内容都要能查看历史、随时回去编辑留言;并且一方改了之后,
--   另一方打开时能收到高亮/提示。需要 updated_at 标记「最后改动时间」。
-- 做法:给三张表加 updated_at + BEFORE UPDATE 触发器自动刷新;补 notes 的
--   作者可编辑策略。前端据「对方行的 updated_at 是否比我上次看到的新」提示。
-- 用法:Supabase 控制台 → SQL Editor → 整段粘贴 → Run。幂等,可重复执行。
-- ============================================================

-- 通用触发器函数:任何 UPDATE 都把 updated_at 刷成 now()
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 默契问答
alter table public.quiz_answers add column if not exists updated_at timestamptz default now();
drop trigger if exists trg_quiz_answers_touch on public.quiz_answers;
create trigger trg_quiz_answers_touch before update on public.quiz_answers
  for each row execute function public.touch_updated_at();

-- 每日一问
alter table public.daily_answers add column if not exists updated_at timestamptz default now();
drop trigger if exists trg_daily_answers_touch on public.daily_answers;
create trigger trg_daily_answers_touch before update on public.daily_answers
  for each row execute function public.touch_updated_at();

-- 小纸条
alter table public.notes add column if not exists updated_at timestamptz default now();
drop trigger if exists trg_notes_touch on public.notes;
create trigger trg_notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

-- 小纸条:允许作者随时编辑自己写的那条(此前只有 select/insert,没有 update)
drop policy if exists "notes_update" on public.notes;
create policy "notes_update" on public.notes
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and is_couple_member(couple_id));

notify pgrst, 'reload schema';
