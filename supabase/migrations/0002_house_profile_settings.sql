-- ============================================================
-- 迁移 0002:小屋改名 + 头像存储桶
-- 用法:在 Supabase 控制台 → SQL Editor 中整段粘贴,执行一次。
-- ============================================================

-- ---------- 1. 小屋名称 ----------

-- 加 name 列,已有的小屋自动填默认名
alter table public.couples
  add column name text not null default '双人小屋';

-- 允许小屋成员更新自己的小屋行
create policy "couples_update" on public.couples
  for update to authenticated
  using (auth.uid() in (member_a, member_b))
  with check (auth.uid() in (member_a, member_b));

-- 列级权限:把表级 update 收回,只放开 name 列。
-- 这样即使有了上面的策略,成员也改不了邀请码/成员字段(那些仍走 RPC)
revoke update on table public.couples from authenticated;
grant update (name) on table public.couples to authenticated;

-- ---------- 2. 头像存储(私有桶 avatars) ----------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- 辅助函数:能否查看某用户的文件(本人,或同小屋的对方)
create or replace function public.can_view_user_files(owner_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select owner_uid = auth.uid() or exists (
    select 1 from couples c
    where (c.member_a = auth.uid() and c.member_b = owner_uid)
       or (c.member_b = auth.uid() and c.member_a = owner_uid)
  );
$$;

-- 路径约定:{用户id}/avatar-时间戳.jpg,第一段目录名即所有者
-- 读:本人 + 同小屋的对方;写/删:仅本人目录
create policy "avatars_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_view_user_files(((storage.foldername(name))[1])::uuid)
  );

create policy "avatars_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
