-- ============================================================
-- COMI v4 — Permite cliente autenticado marcar mesa como ocupada
-- ============================================================
-- A policy comi_tables_write usa comi.my_restaurant_id() que retorna
-- NULL para clientes (não são donos de restaurante), bloqueando o
-- UPDATE feito em TableSelection quando o cliente senta na mesa.

CREATE POLICY "comi_tables_customer_sit" ON comi.tables
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (status = 'occupied');
