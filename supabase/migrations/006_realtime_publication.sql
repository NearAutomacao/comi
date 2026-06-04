-- ============================================================
-- COMI v6 — Adicionar tabelas do schema comi à publicação do
-- Supabase Realtime. Sem isso, postgres_changes com schema:'comi'
-- não dispara eventos — gerente precisa dar F5 para ver updates.
-- ============================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE comi.tables;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE comi.orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE comi.order_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE comi.reservations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
