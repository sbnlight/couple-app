-- ============================================================
-- 迁移 0011:补齐缺失的列(幂等,重复执行也安全)
-- 用途:之前 0006 / 0009 若没完整执行,会缺少下面这几列,导致:
--   · 功能开关(每日打卡/想你)一点就「保存失败」  → 缺 couples.feature_flags
--   · 看不到对方所在时区的时间                      → 缺 profiles.timezone
--   · 每日一问发图报错                              → 缺 daily_answers.image_paths
-- 用法:Supabase 控制台 → SQL Editor → 新建查询 → 整段粘贴 → Run。
-- 全部用 "if exists / if not exists",跑多少次都不会报错。
-- ============================================================

-- 1) 功能开关(每日一问/打卡/想你 的开关,小屋级共享)
alter table if exists public.couples
  add column if not exists feature_flags jsonb not null default '{}'::jsonb;
grant update (feature_flags) on table public.couples to authenticated;

-- 2) 个人时区(App 打开时自动写入,用于显示对方当地时间)
alter table if exists public.profiles
  add column if not exists timezone text;

-- 3) 每日一问的多图回答(最多 9 张图片路径)
alter table if exists public.daily_answers
  add column if not exists image_paths text[];

-- 4) 今日心情(对方在聊天顶栏 / 我们页可见)—— 缺它则心情存不进、语音也无关
alter table if exists public.profiles
  add column if not exists mood text;
alter table if exists public.profiles
  add column if not exists mood_at timestamptz;

-- 5) 消息类型放开到 语音/拍一拍(否则发语音、拍一拍会被旧约束拒绝 → 发送失败)
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

-- 6) 引用回复:被引用的消息 id + 去规范化的预览文本(自包含,渲染不用再查)
alter table if exists public.messages
  add column if not exists reply_to bigint;
alter table if exists public.messages
  add column if not exists reply_preview text;
