-- ============================================================
-- 迁移 0004:聊天增强 —— 自定义表情包 + 已读回执 + 消息类型扩展
-- 用法:在 Supabase 控制台 → SQL Editor 新建查询,整段粘贴执行一次。
-- ============================================================

-- ---------- 1. 消息类型扩展:允许 'sticker'(表情包消息) ----------

-- 先移除旧的 type 检查约束(名字可能因创建方式而异,按定义内容查找),再加新约束
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.messages'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%'
  loop
    execute format('alter table public.messages drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.messages add constraint messages_type_check
  check (type in ('text', 'image', 'sticker'));

-- ---------- 2. 自定义表情包 ----------

-- 表情包元数据:小屋内两人共享可见,各自只能删自己收藏的
create table public.stickers (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid not null references public.profiles(id),
  path text not null, -- stickers 桶内路径:{couple_id}/{uuid}.jpg
  created_at timestamptz default now()
);

alter table public.stickers enable row level security;

create policy "stickers_select" on public.stickers
  for select to authenticated
  using (is_couple_member(couple_id));

create policy "stickers_insert" on public.stickers
  for insert to authenticated
  with check (is_couple_member(couple_id) and owner_id = auth.uid());

create policy "stickers_delete" on public.stickers
  for delete to authenticated
  using (is_couple_member(couple_id) and owner_id = auth.uid());

-- 表情包图片存储(私有桶)
insert into storage.buckets (id, name, public)
values ('stickers', 'stickers', false)
on conflict (id) do nothing;

create policy "stickers_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'stickers'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy "stickers_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'stickers'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy "stickers_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'stickers'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

-- ---------- 3. 已读回执 ----------

-- 每人在每个小屋里有一行,记录"已读到哪条消息"
create table public.read_status (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  last_read_id bigint not null default 0,
  updated_at timestamptz default now(),
  primary key (couple_id, user_id)
);

alter table public.read_status enable row level security;

create policy "read_status_select" on public.read_status
  for select to authenticated
  using (is_couple_member(couple_id));

create policy "read_status_insert" on public.read_status
  for insert to authenticated
  with check (is_couple_member(couple_id) and user_id = auth.uid());

create policy "read_status_update" on public.read_status
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_couple_member(couple_id));

-- 已读位置变化用 Realtime 推给对方
alter publication supabase_realtime add table public.read_status;
