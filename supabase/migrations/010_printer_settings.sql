-- Migration 010: Configurações de impressoras por restaurante

ALTER TABLE comi.restaurants
  ADD COLUMN IF NOT EXISTS printer_kitchen_host TEXT,
  ADD COLUMN IF NOT EXISTS printer_kitchen_port INT DEFAULT 9100,
  ADD COLUMN IF NOT EXISTS printer_bar_host TEXT,
  ADD COLUMN IF NOT EXISTS printer_bar_port INT DEFAULT 9100;

COMMENT ON COLUMN comi.restaurants.printer_kitchen_host IS 'IP da impressora da cozinha na rede local';
COMMENT ON COLUMN comi.restaurants.printer_kitchen_port IS 'Porta TCP da impressora da cozinha (padrão ESC/POS: 9100)';
COMMENT ON COLUMN comi.restaurants.printer_bar_host IS 'IP da impressora do bar na rede local';
COMMENT ON COLUMN comi.restaurants.printer_bar_port IS 'Porta TCP da impressora do bar (padrão ESC/POS: 9100)';
