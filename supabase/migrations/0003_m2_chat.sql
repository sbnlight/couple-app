-- ============================================================
-- 迁移 0003(M2 聊天):消息幂等键 + 聊天图片存储桶
-- 用法:在 Supabase 控制台 → SQL Editor 新建查询,整段粘贴执行一次。
-- ============================================================

-- ---------- 1. 消息幂等键 ----------

-- 客户端为每条消息生成一个 uuid;发送超时后重试时先按它查重,
-- 即使"实际已落库但响应丢失"也不会出现重复消息
alter table public.messages
  add column client_id uuid unique;

-- ---------- 2. 聊天图片存储(私有桶 chat-images) ----------

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

-- 路径约定:{couple_id}/{消息client_id}.jpg,第一段目录名即小屋 id
-- 读/写都要求是该小屋成员(复用 0001 的 is_couple_member)
create policy "chat_images_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

create policy "chat_images_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

-- 发送失败重试时用 upsert 覆盖上传,需要 update 权限
create policy "chat_images_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'chat-images'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'chat-images'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );
