-- ============================================================
-- COMI v7 — Corrige FK de orders e reservations para mesas
-- Sem isso, deletar uma mesa falha mesmo sem pedidos ativos,
-- pois pedidos fechados e reservas antigas ainda referenciam
-- o table_id. Solução: SET NULL ao deletar a mesa.
-- ============================================================

-- orders.table_id → SET NULL (histórico preservado, referência zerada)
ALTER TABLE comi.orders
  DROP CONSTRAINT IF EXISTS orders_table_id_fkey;

ALTER TABLE comi.orders
  ALTER COLUMN table_id DROP NOT NULL;

ALTER TABLE comi.orders
  ADD CONSTRAINT orders_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES comi.tables(id) ON DELETE SET NULL;

-- reservations.table_id → SET NULL
ALTER TABLE comi.reservations
  DROP CONSTRAINT IF EXISTS reservations_table_id_fkey;

ALTER TABLE comi.reservations
  ALTER COLUMN table_id DROP NOT NULL;

ALTER TABLE comi.reservations
  ADD CONSTRAINT reservations_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES comi.tables(id) ON DELETE SET NULL;

-- order_items não tem FK direto para tables, ok.
-- table_sessions já tem ON DELETE CASCADE (migration 005).
