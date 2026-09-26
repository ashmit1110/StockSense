-- ============================================================
-- Migration 010: Stock Balances
-- ============================================================
-- Canonical stored stock value per (product, location).
-- CHECK (on_hand >= 0) is the LAST LINE OF DEFENSE against
-- negative stock. NEVER remove this constraint.
-- ============================================================

CREATE TABLE stock_balances (
  id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid           NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  location_id uuid           NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  on_hand     numeric(14,3)  NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  updated_at  timestamptz    NOT NULL DEFAULT now(),

  UNIQUE (product_id, location_id)
);

-- Index for location-based queries
CREATE INDEX idx_stockbal_location ON stock_balances (location_id);
