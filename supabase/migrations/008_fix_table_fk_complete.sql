-- ============================================================
-- COMI v8 — Fix completo: Remove TODAS as NOT NULL constraints
-- de orders e reservations.table_id. Isso estava bloqueando a
-- exclusão de mesas mesmo com a migration 007.
-- ============================================================

-- 1. Remove constraint NOT NULL de orders.table_id se ainda existir
DO $$
BEGIN
  -- Tenta alterar a coluna
  ALTER TABLE comi.orders
    ALTER COLUMN table_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  -- Se falhar, continua (pode já estar sem NOT NULL)
  NULL;
END $$;

-- 2. Remove constraint NOT NULL de reservations.table_id se ainda existir
DO $$
BEGIN
  ALTER TABLE comi.reservations
    ALTER COLUMN table_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Força DROP de TODAS as FKs antigas (sem CASCADE)
ALTER TABLE comi.orders
  DROP CONSTRAINT IF EXISTS orders_table_id_fkey CASCADE;

ALTER TABLE comi.reservations
  DROP CONSTRAINT IF EXISTS reservations_table_id_fkey CASCADE;

-- 4. Recria com ON DELETE SET NULL garantido
ALTER TABLE comi.orders
  ADD CONSTRAINT orders_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES comi.tables(id) ON DELETE SET NULL;

ALTER TABLE comi.reservations
  ADD CONSTRAINT reservations_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES comi.tables(id) ON DELETE SET NULL;

-- 5. Garantir que table_sessions tenha CASCADE (redundante, mas seguro)
ALTER TABLE comi.table_sessions
  DROP CONSTRAINT IF EXISTS table_sessions_table_id_fkey CASCADE;

ALTER TABLE comi.table_sessions
  ADD CONSTRAINT table_sessions_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES comi.tables(id) ON DELETE CASCADE;

-- Verify: checando que não há mais NOT NULL em table_id
-- SELECT column_name, is_nullable FROM information_schema.columns
-- WHERE table_schema = 'comi' AND column_name = 'table_id';
