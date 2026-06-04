-- ============================================================
-- COMI v2 — Multi-tenant: cada restaurante tem seus dados isolados
-- ============================================================

-- ──────────────────────────────────────────
-- Tabela de restaurantes (um por gerente/dono)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.restaurants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID NOT NULL REFERENCES comi.profiles(id) ON DELETE CASCADE,
  name                TEXT NOT NULL DEFAULT 'Meu Restaurante',
  slug                TEXT UNIQUE,
  logo_url            TEXT,
  address             TEXT,
  mp_access_token     TEXT,
  mp_public_key       TEXT,
  mp_refresh_token    TEXT,
  mp_user_id          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Adicionar restaurant_id em todas as tabelas de dados
-- ──────────────────────────────────────────
ALTER TABLE comi.profiles
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

ALTER TABLE comi.menu_categories
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

ALTER TABLE comi.menu_items
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

ALTER TABLE comi.cost_items
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

ALTER TABLE comi.tables
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

ALTER TABLE comi.working_hours
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

ALTER TABLE comi.closed_dates
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

ALTER TABLE comi.reservations
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

ALTER TABLE comi.orders
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

ALTER TABLE comi.order_items
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

ALTER TABLE comi.payments
  ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES comi.restaurants(id);

-- Remover restaurant_settings global (substituído por comi.restaurants)
DROP TABLE IF EXISTS comi.restaurant_settings;

-- ──────────────────────────────────────────
-- Remover unicidade global de slug em working_hours
-- (agora é por restaurante)
-- ──────────────────────────────────────────
ALTER TABLE comi.working_hours DROP CONSTRAINT IF EXISTS working_hours_day_of_week_key;
ALTER TABLE comi.working_hours
  ADD CONSTRAINT working_hours_restaurant_day_unique UNIQUE (restaurant_id, day_of_week);

-- ──────────────────────────────────────────
-- RLS: restaurants
-- ──────────────────────────────────────────
ALTER TABLE comi.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comi_restaurant_owner" ON comi.restaurants
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "comi_restaurant_read" ON comi.restaurants
  FOR SELECT USING (TRUE); -- clientes podem ler dados básicos do restaurante

-- ──────────────────────────────────────────
-- Helper: retorna o restaurant_id do gerente logado
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION comi.my_restaurant_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM comi.restaurants WHERE owner_id = auth.uid() LIMIT 1;
$$;

-- ──────────────────────────────────────────
-- Atualizar RLS das tabelas para filtrar por restaurant_id
-- ──────────────────────────────────────────

-- menu_categories
DROP POLICY IF EXISTS "comi_menu_cat_read"  ON comi.menu_categories;
DROP POLICY IF EXISTS "comi_menu_cat_write" ON comi.menu_categories;
CREATE POLICY "comi_menu_cat_read"  ON comi.menu_categories FOR SELECT USING (TRUE);
CREATE POLICY "comi_menu_cat_write" ON comi.menu_categories FOR ALL
  USING (restaurant_id = comi.my_restaurant_id());

-- menu_items
DROP POLICY IF EXISTS "comi_items_read"  ON comi.menu_items;
DROP POLICY IF EXISTS "comi_items_write" ON comi.menu_items;
CREATE POLICY "comi_items_read"  ON comi.menu_items FOR SELECT USING (TRUE);
CREATE POLICY "comi_items_write" ON comi.menu_items FOR ALL
  USING (restaurant_id = comi.my_restaurant_id());

-- tables
DROP POLICY IF EXISTS "comi_tables_read"  ON comi.tables;
DROP POLICY IF EXISTS "comi_tables_write" ON comi.tables;
CREATE POLICY "comi_tables_read"  ON comi.tables FOR SELECT USING (TRUE);
CREATE POLICY "comi_tables_write" ON comi.tables FOR ALL
  USING (restaurant_id = comi.my_restaurant_id());

-- working_hours
DROP POLICY IF EXISTS "comi_hours_read"  ON comi.working_hours;
DROP POLICY IF EXISTS "comi_hours_write" ON comi.working_hours;
CREATE POLICY "comi_hours_read"  ON comi.working_hours FOR SELECT USING (TRUE);
CREATE POLICY "comi_hours_write" ON comi.working_hours FOR ALL
  USING (restaurant_id = comi.my_restaurant_id());

-- closed_dates
DROP POLICY IF EXISTS "comi_closed_read"  ON comi.closed_dates;
DROP POLICY IF EXISTS "comi_closed_write" ON comi.closed_dates;
CREATE POLICY "comi_closed_read"  ON comi.closed_dates FOR SELECT USING (TRUE);
CREATE POLICY "comi_closed_write" ON comi.closed_dates FOR ALL
  USING (restaurant_id = comi.my_restaurant_id());

-- orders
DROP POLICY IF EXISTS "comi_orders_self"    ON comi.orders;
DROP POLICY IF EXISTS "comi_orders_insert"  ON comi.orders;
DROP POLICY IF EXISTS "comi_orders_manager" ON comi.orders;
CREATE POLICY "comi_orders_self"   ON comi.orders FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "comi_orders_insert" ON comi.orders FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "comi_orders_manager" ON comi.orders FOR ALL
  USING (restaurant_id = comi.my_restaurant_id());

-- reservations
DROP POLICY IF EXISTS "comi_res_self"    ON comi.reservations;
DROP POLICY IF EXISTS "comi_res_insert"  ON comi.reservations;
DROP POLICY IF EXISTS "comi_res_manager" ON comi.reservations;
CREATE POLICY "comi_res_self"    ON comi.reservations FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "comi_res_insert"  ON comi.reservations FOR INSERT WITH CHECK (customer_id = auth.uid());
CREATE POLICY "comi_res_manager" ON comi.reservations FOR ALL
  USING (restaurant_id = comi.my_restaurant_id());

-- payments
DROP POLICY IF EXISTS "comi_pay_self"    ON comi.payments;
DROP POLICY IF EXISTS "comi_pay_insert"  ON comi.payments;
DROP POLICY IF EXISTS "comi_pay_manager" ON comi.payments;
CREATE POLICY "comi_pay_self"    ON comi.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM comi.orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));
CREATE POLICY "comi_pay_insert"  ON comi.payments FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "comi_pay_manager" ON comi.payments FOR ALL
  USING (restaurant_id = comi.my_restaurant_id());
