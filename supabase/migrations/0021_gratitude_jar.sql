-- ============================================================
-- 迁移 0021:感谢罐 / 夸夸罐
-- 用途:一个两人共享的小罐子,随时丢一张「谢谢你…/今天好喜欢你…」的小纸条;
--   两人都能看、都能加;心情低落时"摇一摇"随机浮出一张过往的暖心话。
-- 用法:Supabase 控制台 → SQL Editor → 粘贴 → Run。幂等,可重复执行。
-- ============================================================

create table if not exists public.gratitudes (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz default now()
);

alter table public.gratitudes enable row level security;

-- 小屋两人都能看;只能以自己身份写;只能删自己写的
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gratitudes' and policyname='gratitudes_select') then
    create policy "gratitudes_select" on public.gratitudes
      for select to authenticated using (is_couple_member(couple_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gratitudes' and policyname='gratitudes_insert') then
    create policy "gratitudes_insert" on public.gratitudes
      for insert to authenticated with check (is_couple_member(couple_id) and author_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='gratitudes' and policyname='gratitudes_delete') then
    create policy "gratitudes_delete" on public.gratitudes
      for delete to authenticated using (author_id = auth.uid());
  end if;
end $$;

create index if not exists gratitudes_couple_idx on public.gratitudes (couple_id, id desc);

notify pgrst, 'reload schema';
