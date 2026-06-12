-- ============================================================
-- 迁移 0006:异地互动功能包
-- 时区 / 见面倒数日 / 纪念日 / 每日一问 / 想你 / 打卡 / 愿望清单 / 留言小纸条
-- 用法:在 Supabase 控制台 → SQL Editor 新建查询,整段粘贴执行一次。
-- ============================================================

-- ---------- 1. 个人时区(App 打开时自动同步设备时区) ----------

alter table public.profiles
  add column timezone text;

-- ---------- 2. 下次见面日期(小屋级,任一成员可设置) ----------

alter table public.couples
  add column next_meet_date date;

-- 0002 中只放开了 name 列的更新权限,这里补上新列(列级授权是叠加的)
grant update (next_meet_date) on table public.couples to authenticated;

-- ---------- 3. 纪念日(两人共同管理) ----------

create table public.anniversaries (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  anniv_date date not null,
  created_at timestamptz default now()
);

alter table public.anniversaries enable row level security;

create policy "anniversaries_select" on public.anniversaries
  for select to authenticated using (is_couple_member(couple_id));
create policy "anniversaries_insert" on public.anniversaries
  for insert to authenticated with check (is_couple_member(couple_id));
create policy "anniversaries_delete" on public.anniversaries
  for delete to authenticated using (is_couple_member(couple_id));

-- ---------- 4. 每日一问 ----------

create table public.daily_answers (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  -- 统一用 UTC 日期作为"当天",保证异地两人看到同一道题
  question_date date not null,
  content text not null,
  created_at timestamptz default now(),
  unique (couple_id, user_id, question_date)
);

alter table public.daily_answers enable row level security;

-- 自己是否已回答某天的问题(security definer 避免策略自引用递归)
create or replace function public.has_answered(cid uuid, qdate date)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from daily_answers
    where couple_id = cid and question_date = qdate and user_id = auth.uid()
  );
$$;

-- 对方是否已回答(给前端显示"TA已回答,快来作答"用)
create or replace function public.partner_answered(cid uuid, qdate date)
returns boolean
language sql stable security definer set search_path = public
as $$
  select is_couple_member(cid) and exists (
    select 1 from daily_answers
    where couple_id = cid and question_date = qdate and user_id <> auth.uid()
  );
$$;

-- 核心规则:对方的答案,自己答完同一天的问题之前不可见(服务端强制)
create policy "daily_answers_select" on public.daily_answers
  for select to authenticated
  using (
    is_couple_member(couple_id)
    and (user_id = auth.uid() or has_answered(couple_id, question_date))
  );

create policy "daily_answers_insert" on public.daily_answers
  for insert to authenticated
  with check (is_couple_member(couple_id) and user_id = auth.uid());

create policy "daily_answers_update" on public.daily_answers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_couple_member(couple_id));

-- ---------- 5. 「想你」一键 + 每日打卡 ----------

create table public.misses (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.misses enable row level security;

create policy "misses_select" on public.misses
  for select to authenticated using (is_couple_member(couple_id));
create policy "misses_insert" on public.misses
  for insert to authenticated
  with check (is_couple_member(couple_id) and user_id = auth.uid());

create table public.checkins (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  -- 同样用 UTC 日期,保证"同一天"对两人一致
  day date not null,
  created_at timestamptz default now(),
  primary key (couple_id, user_id, day)
);

alter table public.checkins enable row level security;

create policy "checkins_select" on public.checkins
  for select to authenticated using (is_couple_member(couple_id));
create policy "checkins_insert" on public.checkins
  for insert to authenticated
  with check (is_couple_member(couple_id) and user_id = auth.uid());

-- ---------- 6. 愿望清单(两人共同管理) ----------

create table public.wishes (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  creator_id uuid not null references public.profiles(id),
  content text not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz default now()
);

alter table public.wishes enable row level security;

create policy "wishes_select" on public.wishes
  for select to authenticated using (is_couple_member(couple_id));
create policy "wishes_insert" on public.wishes
  for insert to authenticated
  with check (is_couple_member(couple_id) and creator_id = auth.uid());
create policy "wishes_update" on public.wishes
  for update to authenticated
  using (is_couple_member(couple_id))
  with check (is_couple_member(couple_id));
create policy "wishes_delete" on public.wishes
  for delete to authenticated using (is_couple_member(couple_id));

-- ---------- 7. 留言小纸条(到时间才能拆开) ----------

create table public.notes (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null,
  unlock_at timestamptz not null,
  created_at timestamptz default now()
);

alter table public.notes enable row level security;

-- 核心规则:写的人随时可见;对方只有到了 unlock_at 之后才查得到这一行
-- (内容在解锁前对对方完全不可见,服务端强制)
create policy "notes_select" on public.notes
  for select to authenticated
  using (
    author_id = auth.uid()
    or (is_couple_member(couple_id) and unlock_at <= now())
  );

create policy "notes_insert" on public.notes
  for insert to authenticated
  with check (is_couple_member(couple_id) and author_id = auth.uid());

create policy "notes_delete" on public.notes
  for delete to authenticated using (author_id = auth.uid());

-- 给对方看的"悬念"信息:有几张未解锁的纸条、最近一张何时开启
create or replace function public.locked_notes_info(cid uuid)
returns table (cnt bigint, next_unlock timestamptz)
language sql stable security definer set search_path = public
as $$
  select count(*), min(unlock_at)
  from notes
  where couple_id = cid
    and author_id <> auth.uid()
    and unlock_at > now()
    and public.is_couple_member(cid);
$$;
