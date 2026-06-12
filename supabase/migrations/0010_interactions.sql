-- ============================================================
-- 迁移 0010:互动增强 —— 语音消息 / 拍一拍 / 今日心情
-- 用法:在 Supabase 控制台 → SQL Editor 新建查询,整段粘贴执行一次。
-- 注意:执行后还需更新 Edge Function push 的代码(见 supabase/functions/push)。
-- ============================================================

-- ---------- 1. 消息类型扩展:voice(语音)/ nudge(拍一拍) ----------

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
  check (type in ('text', 'image', 'sticker', 'voice', 'nudge'));

-- ---------- 2. 今日心情(对方可见,24 小时内有效) ----------

alter table public.profiles
  add column mood text,
  add column mood_at timestamptz;
