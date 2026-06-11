-- ============================================================
-- 迁移 0005:记账增强 —— 多货币 + 收入/支出 + 共同/个人
-- 用法:在 Supabase 控制台 → SQL Editor 新建查询,整段粘贴执行一次。
-- ============================================================

alter table public.expenses
  -- 货币代码(ISO 4217):CNY/USD/EUR/JPY/GBP,前端控制可选范围
  add column currency text not null default 'CNY',
  -- 收支类型:expense=支出,income=收入
  add column kind text not null default 'expense'
    check (kind in ('expense', 'income')),
  -- 范围:shared=两人共同(比如一起吃饭),personal=个人;双方都可见(透明)
  add column scope text not null default 'shared'
    check (scope in ('shared', 'personal'));
