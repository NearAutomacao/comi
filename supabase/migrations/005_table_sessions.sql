-- ============================================================
-- COMI v5 — Histórico de sessões de mesa (acesso por QR code)
-- Clientes informam nome + telefone ao sentar, sem precisar de conta.
-- ============================================================

-- Campos de convidado nas mesas
ALTER TABLE comi.tables
  ADD COLUMN IF NOT EXISTS guest_name  TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

-- Histórico de quem sentou em cada mesa
CREATE TABLE IF NOT EXISTS comi.table_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES comi.restaurants(id) ON DELETE CASCADE,
  table_id      UUID NOT NULL REFERENCES comi.tables(id)      ON DELETE CASCADE,
  guest_name    TEXT NOT NULL,
  guest_phone   TEXT NOT NULL,
  sat_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at       TIMESTAMPTZ
);

ALTER TABLE comi.table_sessions ENABLE ROW LEVEL SECURITY;

-- Gerente vê e edita sessões do próprio restaurante
CREATE POLICY "comi_sessions_manager" ON comi.table_sessions
  FOR ALL USING (restaurant_id = comi.my_restaurant_id());

-- Qualquer um pode registrar entrada (QR code sem login)
CREATE POLICY "comi_sessions_insert" ON comi.table_sessions
  FOR INSERT WITH CHECK (TRUE);
