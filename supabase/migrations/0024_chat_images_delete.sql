-- ============================================================
-- 迁移 0024:补 chat-images 私有桶的 DELETE 策略
-- 背景:撤回图片/语音、或「每日一问」编辑删配图时,前端调用 storage.remove()
--   删除桶内文件;但 0003 只为 chat-images 建了 select/insert/update 策略,
--   漏了 delete,storage.objects 的 DELETE 被 RLS 默认拒绝(静默失败)。
--   后果:①被撤回/替换的文件永久残留,吃 1GB 免费额度;②「撤回删文件」的
--   隐私承诺失效——对方仍能对残留路径重签 URL 看到已撤回的图。
-- 做法:补一条成员级 delete 策略,复用 0001 的 is_couple_member,与
--   select/insert/update 同风格(按文件路径首段 = couple_id 判定成员)。
-- 用法:Supabase 控制台 → SQL Editor → 整段粘贴 → Run。幂等,可重复执行。
-- ============================================================

drop policy if exists "chat_images_delete" on storage.objects;
create policy "chat_images_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and public.is_couple_member(((storage.foldername(name))[1])::uuid)
  );

notify pgrst, 'reload schema';
