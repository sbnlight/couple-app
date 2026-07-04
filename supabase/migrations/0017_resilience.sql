-- ============================================================
-- 迁移 0017(健壮性):补齐可能漏跑的列 + 记账幂等去重键
-- 用途:
--   1) 再次幂等补齐 misses.note / misses.emoji(0012 的内容)——
--      「想TA」一直报「网不好」的真正原因,多半是生产库漏跑了 0012,
--      导致插入 emoji/note 被 PostgREST 拒(找不到列),而被前端宽 catch
--      误显示成网络错误。这里重跑一次,确保列存在。
--   2) 给 expenses 加 client_id(客户端幂等键)+ 唯一索引,和 messages 一致。
--      中美异地弱网下,一笔插入可能「已在服务端提交、但响应超过 10s 被中止」,
--      用户重发就会写入重复账目(污染共享账本)。有了幂等键,重试/重发命中
--      同一 client_id 即被唯一约束拦下,前端把唯一冲突当作「已记成功」。
--   3) notify pgrst 让 PostgREST 立即重载 schema 缓存,避免刚加的列一时不可见。
-- 用法:Supabase 控制台 → SQL Editor → 新建查询 → 整段粘贴 → Run。
-- 幂等:全部 if not exists,可反复执行。
-- 备注:若不确定 0012–0016 是否都跑过,可一并重跑(均幂等)。
--       其中 0016 没跑的话「气泡/字体共享」也不会生效。
-- ============================================================

-- 1) 「想你」可选留言 + 表情(等价于 0012,幂等补跑)
alter table if exists public.misses
  add column if not exists note text;
alter table if exists public.misses
  add column if not exists emoji text;

-- 2) 记账幂等去重键(等价范式见 messages.client_id / 0003)
alter table if exists public.expenses
  add column if not exists client_id uuid;
-- 唯一索引而非列级 unique 约束:可重复执行;NULL 互不冲突,老数据不受影响
create unique index if not exists expenses_client_id_key
  on public.expenses (client_id);

-- 3) 强制 PostgREST 重载 schema 缓存(新列立即可用)
notify pgrst, 'reload schema';
