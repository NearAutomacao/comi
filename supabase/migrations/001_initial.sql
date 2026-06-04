-- ============================================================
-- COMI — Schema inicial (schema isolado: comi)
-- Compartilha o mesmo projeto Supabase do gas-delivery-system
-- gas-delivery usa o schema PUBLIC, COMI usa o schema COMI
-- ============================================================

-- ──────────────────────────────────────────
-- Schema próprio do COMI
-- ──────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS comi;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────
-- Profiles COMI (clientes e gerentes do restaurante)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  cpf         TEXT UNIQUE,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'manager')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: ao criar usuário via COMI, insere em comi.profiles
-- (o trigger do gas-delivery insere em public.profiles — ambos coexistem)
CREATE OR REPLACE FUNCTION comi.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Só cria profile COMI se o usuário veio do app COMI
  IF NEW.raw_user_meta_data->>'app' = 'comi' OR NEW.raw_user_meta_data->>'role' IN ('customer','manager') THEN
    INSERT INTO comi.profiles (id, name, phone, cpf, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'cpf',
      COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comi_on_auth_user_created ON auth.users;
CREATE TRIGGER comi_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE comi.handle_new_user();

-- ──────────────────────────────────────────
-- Categorias do cardápio
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.menu_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO comi.menu_categories (name, slug, display_order) VALUES
  ('Porções',    'porcoes',    1),
  ('Lanches',    'lanches',    2),
  ('Bebidas',    'bebidas',    3),
  ('Sobremesas', 'sobremesas', 4)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────
-- Itens do cardápio
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.menu_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES comi.menu_categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL,
  photo_url     TEXT,
  available     BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Ingredientes / Custo por prato
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.cost_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES comi.menu_items(id) ON DELETE CASCADE,
  ingredient   TEXT NOT NULL,
  quantity     TEXT,
  unit_cost    NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ──────────────────────────────────────────
-- Mesas
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.tables (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number     INT NOT NULL,
  capacity   INT NOT NULL DEFAULT 4,
  pos_x      FLOAT NOT NULL DEFAULT 50,
  pos_y      FLOAT NOT NULL DEFAULT 50,
  status     TEXT NOT NULL DEFAULT 'empty' CHECK (status IN ('empty', 'reserved', 'occupied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Horários de funcionamento
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.working_hours (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week  INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time    TIME,
  close_time   TIME,
  is_open      BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (day_of_week)
);

INSERT INTO comi.working_hours (day_of_week, open_time, close_time, is_open) VALUES
  (0, '11:00', '23:00', TRUE),
  (1, '11:00', '23:00', TRUE),
  (2, '11:00', '23:00', TRUE),
  (3, '11:00', '23:00', TRUE),
  (4, '11:00', '23:00', TRUE),
  (5, '11:00', '23:00', TRUE),
  (6, '11:00', '23:00', TRUE)
ON CONFLICT (day_of_week) DO NOTHING;

-- ──────────────────────────────────────────
-- Datas fechadas
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.closed_dates (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date   DATE NOT NULL UNIQUE,
  reason TEXT
);

-- ──────────────────────────────────────────
-- Reservas
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id       UUID NOT NULL REFERENCES comi.tables(id),
  customer_id    UUID NOT NULL REFERENCES comi.profiles(id),
  date           DATE NOT NULL,
  time           TIME NOT NULL,
  guest_count    INT NOT NULL DEFAULT 2,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  payment_id     TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Pedidos
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id       UUID NOT NULL REFERENCES comi.tables(id),
  customer_id    UUID REFERENCES comi.profiles(id),
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'preparing', 'served', 'closed', 'cancelled')),
  total          NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Itens do pedido
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES comi.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES comi.menu_items(id),
  quantity     INT NOT NULL DEFAULT 1,
  unit_price   NUMERIC(10,2) NOT NULL,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'preparing', 'ready', 'served'))
);

-- Recalcula o total automaticamente
CREATE OR REPLACE FUNCTION comi.update_order_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE comi.orders
  SET total = (
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    FROM comi.order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  )
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comi_order_total ON comi.order_items;
CREATE TRIGGER trg_comi_order_total
  AFTER INSERT OR UPDATE OR DELETE ON comi.order_items
  FOR EACH ROW EXECUTE PROCEDURE comi.update_order_total();

-- ──────────────────────────────────────────
-- Pagamentos
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES comi.orders(id),
  reservation_id  UUID REFERENCES comi.reservations(id),
  method          TEXT CHECK (method IN ('credit_card', 'debit_card', 'pix')),
  amount          NUMERIC(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
  mercadopago_id  TEXT,
  installments    INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────
-- Configurações do restaurante
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.restaurant_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mercadopago_access_token  TEXT,
  mercadopago_public_key    TEXT,
  restaurant_name           TEXT NOT NULL DEFAULT 'Comi',
  address                   TEXT
);

INSERT INTO comi.restaurant_settings (restaurant_name) VALUES ('Comi')
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────
-- Storage bucket para fotos do cardápio
-- ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-photos', 'menu-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────
-- Row Level Security
-- ──────────────────────────────────────────
ALTER TABLE comi.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.menu_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.menu_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.cost_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.tables             ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.working_hours      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.closed_dates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.reservations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE comi.restaurant_settings ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se usuário é gerente COMI
CREATE OR REPLACE FUNCTION comi.is_manager()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM comi.profiles
    WHERE id = auth.uid() AND role = 'manager'
  );
$$;

-- Profiles
CREATE POLICY "comi_profiles_self"    ON comi.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "comi_profiles_manager" ON comi.profiles FOR ALL USING (comi.is_manager());

-- Cardápio (leitura pública)
CREATE POLICY "comi_menu_cat_read"  ON comi.menu_categories FOR SELECT USING (TRUE);
CREATE POLICY "comi_menu_cat_write" ON comi.menu_categories FOR ALL USING (comi.is_manager());
CREATE POLICY "comi_items_read"     ON comi.menu_items FOR SELECT USING (TRUE);
CREATE POLICY "comi_items_write"    ON comi.menu_items FOR ALL USING (comi.is_manager());
CREATE POLICY "comi_costs_read"     ON comi.cost_items FOR SELECT USING (comi.is_manager());
CREATE POLICY "comi_costs_write"    ON comi.cost_items FOR ALL USING (comi.is_manager());

-- Mesas (leitura pública para QR code)
CREATE POLICY "comi_tables_read"  ON comi.tables FOR SELECT USING (TRUE);
CREATE POLICY "comi_tables_write" ON comi.tables FOR ALL USING (comi.is_manager());

-- Horários e datas (leitura pública)
CREATE POLICY "comi_hours_read"   ON comi.working_hours FOR SELECT USING (TRUE);
CREATE POLICY "comi_hours_write"  ON comi.working_hours FOR ALL USING (comi.is_manager());
CREATE POLICY "comi_closed_read"  ON comi.closed_dates FOR SELECT USING (TRUE);
CREATE POLICY "comi_closed_write" ON comi.closed_dates FOR ALL USING (comi.is_manager());

-- Reservas
CREATE POLICY "comi_res_self"    ON comi.reservations FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "comi_res_insert"  ON comi.reservations FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "comi_res_manager" ON comi.reservations FOR ALL USING (comi.is_manager());

-- Pedidos
CREATE POLICY "comi_orders_self"    ON comi.orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "comi_orders_insert"  ON comi.orders FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "comi_orders_manager" ON comi.orders FOR ALL USING (comi.is_manager());

CREATE POLICY "comi_oi_select" ON comi.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM comi.orders o WHERE o.id = order_id
    AND (o.customer_id = auth.uid() OR comi.is_manager()))
);
CREATE POLICY "comi_oi_insert" ON comi.order_items FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "comi_oi_update" ON comi.order_items FOR UPDATE USING (comi.is_manager());

-- Pagamentos
CREATE POLICY "comi_pay_self"    ON comi.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM comi.orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));
CREATE POLICY "comi_pay_insert"  ON comi.payments FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "comi_pay_manager" ON comi.payments FOR ALL USING (comi.is_manager());

-- Configurações
CREATE POLICY "comi_settings_read"    ON comi.restaurant_settings FOR SELECT USING (TRUE);
CREATE POLICY "comi_settings_manager" ON comi.restaurant_settings FOR ALL USING (comi.is_manager());

-- Storage: fotos do cardápio
CREATE POLICY "comi_storage_read"   ON storage.objects FOR SELECT USING (bucket_id = 'menu-photos');
CREATE POLICY "comi_storage_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-photos' AND auth.role() = 'authenticated');
CREATE POLICY "comi_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-photos' AND comi.is_manager());
