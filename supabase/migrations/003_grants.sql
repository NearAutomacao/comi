-- ============================================================
-- COMI v3 — Grants de acesso ao schema comi
-- OBRIGATÓRIO: sem isso nenhuma query ao schema comi funciona
-- ============================================================

GRANT USAGE ON SCHEMA comi TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA comi TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA comi TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA comi TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA comi
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA comi
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA comi
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
