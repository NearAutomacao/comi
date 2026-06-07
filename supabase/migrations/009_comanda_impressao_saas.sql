-- ============================================================
-- COMI v9 — Comanda por pessoa, código de pedido, impressão, SaaS
-- ============================================================

-- ──────────────────────────────────────────
-- 1. Sequência de código de pedido por restaurante
--    Atômica: garante que dois pedidos simultâneos nunca recebem o mesmo código
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.order_sequences (
  restaurant_id UUID PRIMARY KEY REFERENCES comi.restaurants(id) ON DELETE CASCADE,
  last_code     BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE comi.order_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comi_order_seq_all" ON comi.order_sequences FOR ALL USING (TRUE);

CREATE OR REPLACE FUNCTION comi.next_order_code(p_restaurant_id UUID)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_code BIGINT;
BEGIN
  INSERT INTO comi.order_sequences (restaurant_id, last_code)
  VALUES (p_restaurant_id, 1)
  ON CONFLICT (restaurant_id) DO UPDATE
    SET last_code = comi.order_sequences.last_code + 1
  RETURNING last_code INTO v_code;
  RETURN v_code;
END;
$$;

-- ──────────────────────────────────────────
-- 2. Código e session_id nos pedidos
-- ──────────────────────────────────────────
ALTER TABLE comi.orders
  ADD COLUMN IF NOT EXISTS code       BIGINT,
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES comi.table_sessions(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────
-- 3. Impressora por categoria do cardápio
-- ──────────────────────────────────────────
ALTER TABLE comi.menu_categories
  ADD COLUMN IF NOT EXISTS printer TEXT CHECK (printer IN ('kitchen', 'bar'));

-- Padrão: Bebidas -> bar, demais -> kitchen
UPDATE comi.menu_categories
  SET printer = 'bar'
  WHERE slug = 'bebidas' AND printer IS NULL;

UPDATE comi.menu_categories
  SET printer = 'kitchen'
  WHERE slug != 'bebidas' AND printer IS NULL;

-- ──────────────────────────────────────────
-- 4. Fila de impressão
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.print_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES comi.restaurants(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES comi.orders(id)      ON DELETE CASCADE,
  printer       TEXT NOT NULL CHECK (printer IN ('kitchen', 'bar')),
  items         JSONB NOT NULL DEFAULT '[]',
  table_number  INT,
  guest_name    TEXT,
  order_code    BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  printed_at    TIMESTAMPTZ
);

ALTER TABLE comi.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comi_print_jobs_select" ON comi.print_jobs
  FOR SELECT USING (restaurant_id = comi.my_restaurant_id());
CREATE POLICY "comi_print_jobs_insert" ON comi.print_jobs
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "comi_print_jobs_update" ON comi.print_jobs
  FOR UPDATE USING (restaurant_id = comi.my_restaurant_id());

-- ──────────────────────────────────────────
-- 5. Assinaturas SaaS (mensalidade)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comi.subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL UNIQUE REFERENCES comi.restaurants(id) ON DELETE CASCADE,
  plan              TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'basic', 'pro')),
  status            TEXT NOT NULL DEFAULT 'trial'
                      CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
  starts_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,
  mp_preapproval_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE comi.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comi_subscriptions_owner" ON comi.subscriptions
  FOR ALL USING (restaurant_id = comi.my_restaurant_id());
CREATE POLICY "comi_subscriptions_read" ON comi.subscriptions
  FOR SELECT USING (TRUE);

-- Ao criar restaurante, cria automaticamente trial de 30 dias
CREATE OR REPLACE FUNCTION comi.create_restaurant_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO comi.subscriptions (restaurant_id, plan, status, starts_at, expires_at)
  VALUES (NEW.id, 'trial', 'trial', NOW(), NOW() + INTERVAL '30 days')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comi_restaurant_subscription ON comi.restaurants;
CREATE TRIGGER trg_comi_restaurant_subscription
  AFTER INSERT ON comi.restaurants
  FOR EACH ROW EXECUTE PROCEDURE comi.create_restaurant_subscription();

-- Cria subscriptions trial para restaurantes existentes que ainda não têm
INSERT INTO comi.subscriptions (restaurant_id, plan, status, starts_at, expires_at)
SELECT id, 'trial', 'active', NOW(), NOW() + INTERVAL '365 days'
FROM comi.restaurants r
WHERE NOT EXISTS (
  SELECT 1 FROM comi.subscriptions s WHERE s.restaurant_id = r.id
)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────
-- 6. Método de pagamento: adicionar 'cash' (dinheiro)
-- ──────────────────────────────────────────
ALTER TABLE comi.payments
  DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE comi.payments
  ADD CONSTRAINT payments_method_check
    CHECK (method IN ('credit_card', 'debit_card', 'pix', 'cash'));

-- ──────────────────────────────────────────
-- 7. Realtime para print_jobs (agente de impressão recebe em tempo real)
-- ──────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE comi.print_jobs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE comi.table_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────
-- 8. Grants para novas tabelas
-- ──────────────────────────────────────────
GRANT ALL ON comi.order_sequences  TO anon, authenticated, service_role;
GRANT ALL ON comi.print_jobs       TO anon, authenticated, service_role;
GRANT ALL ON comi.subscriptions    TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION comi.next_order_code(UUID)              TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION comi.create_restaurant_subscription()   TO service_role;
