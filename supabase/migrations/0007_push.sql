-- ============================================================
-- 迁移 0007:Web Push 推送订阅
-- 用法:在 Supabase 控制台 → SQL Editor 新建查询,整段粘贴执行一次。
-- ============================================================

-- 每台开启了通知的设备一行(同一人可有多台设备)
create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 浏览器推送服务给这台设备的唯一地址
  endpoint text not null unique,
  -- Web Push 加密所需的两把客户端密钥
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

-- 各自只能管理自己设备的订阅;Edge Function 用 service_role 读,不受 RLS 限制
create policy "push_select" on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

create policy "push_insert" on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid() and is_couple_member(couple_id));

create policy "push_update" on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_couple_member(couple_id));

create policy "push_delete" on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());
