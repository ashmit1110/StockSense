-- ============================================================
-- Migration 013: Row Level Security Policies
-- ============================================================
-- Enable RLS on all tables. Authenticated users get broad read
-- access. Write access is restricted per table.
-- Stock mutations and ledger inserts happen through SECURITY
-- DEFINER RPCs only.
-- ============================================================

-- ==================== PROFILES ====================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ==================== CATEGORIES ====================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "categories_insert"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "categories_update"
  ON categories FOR UPDATE
  TO authenticated
  USING (true);

-- ==================== PRODUCTS ====================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "products_insert"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "products_update"
  ON products FOR UPDATE
  TO authenticated
  USING (true);

-- ==================== WAREHOUSES ====================
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses_select"
  ON warehouses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "warehouses_insert"
  ON warehouses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "warehouses_update"
  ON warehouses FOR UPDATE
  TO authenticated
  USING (true);

-- ==================== LOCATIONS ====================
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_select"
  ON locations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "locations_insert"
  ON locations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "locations_update"
  ON locations FOR UPDATE
  TO authenticated
  USING (true);

-- ==================== OPERATIONS ====================
-- Read: all authenticated users.
-- Write: via SECURITY DEFINER RPCs only.
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operations_select"
  ON operations FOR SELECT
  TO authenticated
  USING (true);

-- ==================== OPERATION LINES ====================
-- Read: all authenticated users.
-- Write: via SECURITY DEFINER RPCs (follows parent operations).
ALTER TABLE operation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oplines_select"
  ON operation_lines FOR SELECT
  TO authenticated
  USING (true);

-- ==================== STOCK BALANCES ====================
-- Read: all authenticated users.
-- Write: via SECURITY DEFINER RPCs only.
ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stockbal_select"
  ON stock_balances FOR SELECT
  TO authenticated
  USING (true);

-- ==================== STOCK LEDGER ====================
-- Read: all authenticated users.
-- Insert: via SECURITY DEFINER RPCs only.
-- Update/Delete: blocked by trigger + no RLS policy.
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_select"
  ON stock_ledger FOR SELECT
  TO authenticated
  USING (true);
