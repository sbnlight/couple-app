-- ============================================================
-- 迁移 0025:允许「已创建但尚未配对成功」的一方解散自己的空屋
-- 背景:若两人各自都点了「创建小屋」,双方各成为自己空屋的 member_a,都卡在
--   「等待对方加入」页;此时 create/join 都因 ALREADY_PAIRED 被拒,couples 表
--   又无 update/delete 策略,前端无法退出 → 配对死锁,只能手动改库。
-- 做法:新增 security definer RPC,仅当调用者是某小屋的 member_a 且该屋还没有
--   member_b(空屋)时,删除该行。删除后前端 refresh 回到创建/加入页,即可改为
--   输入对方邀请码加入。已配对的小屋(member_b 非空)绝不受影响。
-- 用法:Supabase 控制台 → SQL Editor → 整段粘贴 → Run。幂等,可重复执行。
-- ============================================================

create or replace function public.dissolve_my_empty_couple()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.couples
   where member_a = auth.uid()
     and member_b is null;   -- 只删自己的、尚无第二人的空屋
end;
$$;

revoke execute on function public.dissolve_my_empty_couple() from anon, public;
grant execute on function public.dissolve_my_empty_couple() to authenticated;

notify pgrst, 'reload schema';
