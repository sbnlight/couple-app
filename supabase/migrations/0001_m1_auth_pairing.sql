-- ============================================================
-- M1 迁移:建表 + RLS + 注册触发器 + 配对 RPC
-- 用法:在 Supabase 控制台 → SQL Editor 中整段粘贴,执行一次。
-- ============================================================

-- ---------- 1. 表结构(与 CLAUDE.md 第 6 节一致) ----------

-- 用户资料,与 auth.users 一一对应,由下面的触发器自动创建
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

-- 情侣"小屋",一对一条记录;第二人加入前 member_b 为 null
create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text unique not null,
  member_a uuid not null references public.profiles(id),
  member_b uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 聊天消息(M2 使用,本次一并建好)
create table public.messages (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  type text not null default 'text' check (type in ('text','image')),
  content text not null,
  created_at timestamptz default now()
);

-- 账目流水(M3 使用,本次一并建好)
create table public.expenses (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  payer_id uuid not null references public.profiles(id),
  amount numeric(10,2) not null check (amount > 0),
  category text not null,
  note text,
  spent_at date not null default current_date,
  created_at timestamptz default now()
);

-- 索引:消息分页/增量补拉;账单按月查询
create index messages_couple_id_idx on public.messages (couple_id, id desc);
create index expenses_couple_month_idx on public.expenses (couple_id, spent_at desc);

-- ---------- 2. 辅助函数与触发器 ----------

-- 判断当前登录用户是否为某小屋成员;security definer 绕过 RLS 避免递归,
-- 供各表策略复用
create or replace function public.is_couple_member(cid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from couples c
    where c.id = cid and auth.uid() in (c.member_a, c.member_b)
  );
$$;

-- 注册时自动建立 profiles 档案,昵称取注册时附带的 display_name
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), '未命名')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 生成 6 位邀请码;字母表排除了易混淆的 0/O/1/I/L
create or replace function public.gen_invite_code()
returns text
language sql volatile
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31) + 1)::int, 1),
    ''
  )
  from generate_series(1, 6);
$$;

-- ---------- 3. 配对 RPC(security definer,前端唯一的写 couples 入口) ----------

-- 创建小屋:生成邀请码并插入 couples;撞码(unique 冲突)自动重试
create or replace function public.create_couple()
returns public.couples
language plpgsql security definer set search_path = public
as $$
declare
  result public.couples;
  attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if exists (select 1 from couples c where auth.uid() in (c.member_a, c.member_b)) then
    raise exception 'ALREADY_PAIRED';
  end if;
  loop
    begin
      insert into couples (invite_code, member_a)
      values (gen_invite_code(), auth.uid())
      returning * into result;
      return result;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts >= 5 then raise; end if;
    end;
  end loop;
end;
$$;

-- 凭邀请码加入小屋;错误码会原样传给前端翻译成中文提示
create or replace function public.join_couple_by_code(code text)
returns public.couples
language plpgsql security definer set search_path = public
as $$
declare
  target public.couples;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if exists (select 1 from couples c where auth.uid() in (c.member_a, c.member_b)) then
    raise exception 'ALREADY_PAIRED';
  end if;

  select * into target from couples where invite_code = upper(trim(code));
  if not found then
    raise exception 'CODE_NOT_FOUND';
  end if;
  if target.member_a = auth.uid() then
    raise exception 'CANNOT_JOIN_SELF';
  end if;
  if target.member_b is not null then
    raise exception 'HOUSE_FULL';
  end if;

  update couples set member_b = auth.uid()
  where id = target.id
  returning * into target;
  return target;
end;
$$;

-- RPC 只允许已登录用户调用
revoke execute on function public.create_couple() from anon, public;
revoke execute on function public.join_couple_by_code(text) from anon, public;
grant execute on function public.create_couple() to authenticated;
grant execute on function public.join_couple_by_code(text) to authenticated;

-- ---------- 4. RLS 策略(全表开启;策略矩阵见 DESIGN.md 3.2) ----------

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.messages enable row level security;
alter table public.expenses enable row level security;

-- profiles:本人 + 同小屋的对方可读;仅本人可改;插入只由触发器完成
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from couples c
      where (c.member_a = auth.uid() and c.member_b = profiles.id)
         or (c.member_b = auth.uid() and c.member_a = profiles.id)
    )
  );

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- couples:仅成员可读;不开放直接写,创建/加入一律走上面的 RPC
-- (这样邀请码无法被外人枚举查询)
create policy "couples_select" on public.couples
  for select to authenticated
  using (auth.uid() in (member_a, member_b));

-- messages:仅小屋成员可读;发消息必须是成员且发送者是本人;不可改不可删
create policy "messages_select" on public.messages
  for select to authenticated
  using (is_couple_member(couple_id));

create policy "messages_insert" on public.messages
  for insert to authenticated
  with check (is_couple_member(couple_id) and sender_id = auth.uid());

-- expenses:仅成员可读;记账人必须是付款人本人;仅本人可改删自己记的账
create policy "expenses_select" on public.expenses
  for select to authenticated
  using (is_couple_member(couple_id));

create policy "expenses_insert" on public.expenses
  for insert to authenticated
  with check (is_couple_member(couple_id) and payer_id = auth.uid());

create policy "expenses_update" on public.expenses
  for update to authenticated
  using (payer_id = auth.uid())
  with check (payer_id = auth.uid() and is_couple_member(couple_id));

create policy "expenses_delete" on public.expenses
  for delete to authenticated
  using (payer_id = auth.uid());

-- ---------- 5. Realtime:对 messages 开启变更推送(M2 订阅用) ----------

alter publication supabase_realtime add table public.messages;
