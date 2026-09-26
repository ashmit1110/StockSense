-- ============================================================
-- Migration 012: updated_at Triggers
-- ============================================================
-- Generic trigger function that sets updated_at = now()
-- on every UPDATE. Applied to all tables with updated_at.
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to every table that has an updated_at column
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stockbal_updated_at
  BEFORE UPDATE ON stock_balances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
