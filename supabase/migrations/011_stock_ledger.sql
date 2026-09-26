-- ============================================================
-- Migration 011: Stock Ledger
-- ============================================================
-- Append-only immutable ledger. Every DONE operation writes
-- ledger rows. No UPDATE or DELETE is ever allowed.
-- ============================================================

CREATE TABLE stock_ledger (
  id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid           NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  location_id         uuid           NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  quantity_change     numeric(14,3)  NOT NULL CHECK (quantity_change <> 0),
  movement_type       movement_type  NOT NULL,
  operation_id        uuid           NOT NULL REFERENCES operations(id) ON DELETE RESTRICT,
  operation_reference text           NOT NULL,
  user_id             uuid           NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz    NOT NULL DEFAULT now()
);

-- Indexes for Move History and product lookups
CREATE INDEX idx_ledger_product_date ON stock_ledger (product_id, created_at DESC);
CREATE INDEX idx_ledger_created_at   ON stock_ledger (created_at DESC);
CREATE INDEX idx_ledger_location     ON stock_ledger (location_id);
CREATE INDEX idx_ledger_operation    ON stock_ledger (operation_id);

-- ============================================================
-- Immutability trigger: prevent UPDATE and DELETE
-- ============================================================
CREATE OR REPLACE FUNCTION prevent_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'stock_ledger rows are immutable';
END;
$$;

CREATE TRIGGER trg_ledger_immutable
  BEFORE UPDATE OR DELETE ON stock_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_mutation();
