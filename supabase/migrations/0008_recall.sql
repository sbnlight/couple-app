-- ============================================================
-- 迁移 0008:消息撤回
-- 用法:在 Supabase 控制台 → SQL Editor 新建查询,整段粘贴执行一次。
-- ============================================================

-- 撤回标记;撤回时同时清空内容
alter table public.messages
  add column recalled boolean not null default false;

-- 撤回 RPC:仅发送者本人、发出 2 分钟内可撤回。
-- 用 security definer 绕过"消息不可改"的 RLS 总原则,把可改动收口在这一个函数里。
create or replace function public.recall_message(mid bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  m messages;
begin
  select * into m from messages where id = mid;
  if not found or m.sender_id <> auth.uid() then
    raise exception 'NOT_ALLOWED';
  end if;
  if m.recalled then
    return; -- 已撤回,幂等
  end if;
  if now() - m.created_at > interval '2 minutes' then
    raise exception 'RECALL_TIMEOUT';
  end if;
  update messages set recalled = true, content = '' where id = mid;
end;
$$;

revoke execute on function public.recall_message(bigint) from anon, public;
grant execute on function public.recall_message(bigint) to authenticated;
