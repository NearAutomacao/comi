-- ============================================================
-- COMI v8 — Fix completo: Remove FKs antigas e recria com CASCADE
-- ============================================================

-- 1. PRIMEIRO: Remove NOT NULL constraint de orders.table_id
ALTER TABLE comi.orders
  ALTER COLUMN table_id DROP NOT NULL;

-- 2. Remove NOT NULL constraint de reservations.table_id
ALTER TABLE comi.reservations
  ALTER COLUMN table_id DROP NOT NULL;

-- 3. Agora pode setar NULL: orders
UPDATE comi.orders SET table_id = NULL;

-- 4. Agora pode setar NULL: reservations
UPDATE comi.reservations SET table_id = NULL;

-- 5. Deleta table_sessions órfãs
DELETE FROM comi.table_sessions 
  WHERE NOT EXISTS (SELECT 1 FROM comi.tables t WHERE t.id = comi.table_sessions.table_id);

-- 6. Remove constraint ANTIGA de orders
ALTER TABLE comi.orders
  DROP CONSTRAINT IF EXISTS orders_table_id_fkey;

-- 7. Recria FK com ON DELETE SET NULL
ALTER TABLE comi.orders
  ADD CONSTRAINT orders_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES comi.tables(id) ON DELETE SET NULL;

-- 8. Remove constraint ANTIGA de reservations
ALTER TABLE comi.reservations
  DROP CONSTRAINT IF EXISTS reservations_table_id_fkey;

-- 9. Recria FK com ON DELETE SET NULL
ALTER TABLE comi.reservations
  ADD CONSTRAINT reservations_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES comi.tables(id) ON DELETE SET NULL;

-- 10. Garante que table_sessions tenha CASCADE
ALTER TABLE comi.table_sessions
  DROP CONSTRAINT IF EXISTS table_sessions_table_id_fkey;

ALTER TABLE comi.table_sessions
  ADD CONSTRAINT table_sessions_table_id_fkey
  FOREIGN KEY (table_id) REFERENCES comi.tables(id) ON DELETE CASCADE;
