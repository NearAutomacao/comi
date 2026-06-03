-- ============================================================
-- COMI — Schema inicial
-- Rode no Supabase SQL Editor ou via CLI: supabase db push
-- ============================================================

-- ──────────────────────────────────────────
-- Extensões
-- ──────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────
-- Profiles (espelha auth.users)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  cpf         TEXT UNIQUE,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'manager')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cria profile automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, phone, cpf, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'cpf',
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ──────────────────────────────────────────
-- Categorias do cardápio
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categorias padrão
INSERT INTO menu_categories (name, slug, display_order) VALUES
  ('Porções',    'porcoes',    1),
  ('Lanches',    'lanches',    2),
  ('Bebidas',    'bebidas',    3),
  ('Sobremesas', 'sobremesas', 4)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────
-- Itens do cardápio
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS cost_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient   TEXT NOT NULL,
  quantity     TEXT,
  unit_cost    NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ──────────────────────────────────────────
-- Mesas
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tables (
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
CREATE TABLE IF NOT EXISTS working_hours (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week  INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time    TIME,
  close_time   TIME,
  is_open      BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (day_of_week)
);

-- Horários padrão (Seg-Sex 11h-23h, Sáb-Dom 11h-00h)
INSERT INTO working_hours (day_of_week, open_time, close_time, is_open) VALUES
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
CREATE TABLE IF NOT EXISTS closed_dates (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date   DATE NOT NULL UNIQUE,
  reason TEXT
);

-- ──────────────────────────────────────────
-- Reservas
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id       UUID NOT NULL REFERENCES tables(id),
  customer_id    UUID NOT NULL REFERENCES profiles(id),
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
CREATE TABLE IF NOT EXISTS orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id       UUID NOT NULL REFERENCES tables(id),
  customer_id    UUID REFERENCES profiles(id),
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
CREATE TABLE IF NOT EXISTS order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity     INT NOT NULL DEFAULT 1,
  unit_price   NUMERIC(10,2) NOT NULL,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'preparing', 'ready', 'served'))
);

-- Recalcula o total do pedido automaticamente
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE orders
  SET total = (
    SELECT COALESCE(SUM(quantity * unit_price), 0)
    FROM order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  )
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_order_total ON order_items;
CREATE TRIGGER trg_update_order_total
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE PROCEDURE update_order_total();

-- ──────────────────────────────────────────
-- Pagamentos
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id),
  reservation_id  UUID REFERENCES reservations(id),
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
CREATE TABLE IF NOT EXISTS restaurant_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mercadopago_access_token  TEXT,
  mercadopago_public_key    TEXT,
  restaurant_name           TEXT NOT NULL DEFAULT 'Comi',
  address                   TEXT
);

INSERT INTO restaurant_settings (restaurant_name) VALUES ('Comi')
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────
-- Storage bucket para fotos
-- ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-photos', 'menu-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────
-- Row Level Security
-- ──────────────────────────────────────────
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables             ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours      ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_dates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: usuário vê o próprio, gerente vê todos
CREATE POLICY "profiles_self"    ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_manager" ON profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- Cardápio: leitura pública, escrita só manager
CREATE POLICY "menu_read"    ON menu_categories FOR SELECT USING (TRUE);
CREATE POLICY "menu_write"   ON menu_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

CREATE POLICY "items_read"   ON menu_items FOR SELECT USING (TRUE);
CREATE POLICY "items_write"  ON menu_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

CREATE POLICY "costs_read"   ON cost_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
CREATE POLICY "costs_write"  ON cost_items FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- Mesas: leitura pública (para QR code), escrita só manager
CREATE POLICY "tables_read"  ON tables FOR SELECT USING (TRUE);
CREATE POLICY "tables_write" ON tables FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- Horários e datas: leitura pública
CREATE POLICY "hours_read"  ON working_hours FOR SELECT USING (TRUE);
CREATE POLICY "hours_write" ON working_hours FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

CREATE POLICY "closed_read"  ON closed_dates FOR SELECT USING (TRUE);
CREATE POLICY "closed_write" ON closed_dates FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- Reservas: cliente vê as suas, manager vê todas
CREATE POLICY "res_self"    ON reservations FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "res_manager" ON reservations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
CREATE POLICY "res_insert"  ON reservations FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Pedidos: cliente vê os seus, manager vê todos
CREATE POLICY "orders_self"    ON orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "orders_manager" ON orders FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
CREATE POLICY "orders_insert"  ON orders FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "oi_select" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (o.customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager')))
);
CREATE POLICY "oi_insert" ON order_items FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "oi_update" ON order_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));

-- Pagamentos: cliente vê os seus, manager vê todos
CREATE POLICY "pay_self"    ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));
CREATE POLICY "pay_manager" ON payments FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
CREATE POLICY "pay_insert"  ON payments FOR INSERT WITH CHECK (TRUE);

-- Configurações: só manager
CREATE POLICY "settings_manager" ON restaurant_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
CREATE POLICY "settings_read" ON restaurant_settings FOR SELECT USING (TRUE);

-- Storage: leitura pública, upload autenticado
CREATE POLICY "storage_read"   ON storage.objects FOR SELECT USING (bucket_id = 'menu-photos');
CREATE POLICY "storage_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-photos' AND auth.role() = 'authenticated');
CREATE POLICY "storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'menu-photos'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'));
