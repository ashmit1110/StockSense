-- ============================================================
-- Migration 005: Products
-- ============================================================

CREATE TABLE products (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text           NOT NULL,
  sku             text           NOT NULL UNIQUE,
  category_id     uuid           NULL REFERENCES categories(id) ON DELETE SET NULL,
  unit_of_measure text           NOT NULL DEFAULT 'pcs',
  reorder_level   numeric(14,3)  NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  unit_cost       numeric(14,2)  NULL CHECK (unit_cost IS NULL OR unit_cost >= 0),
  is_active       boolean        NOT NULL DEFAULT true,
  created_by      uuid           NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz    NOT NULL DEFAULT now(),
  updated_at      timestamptz    NOT NULL DEFAULT now()
);

-- Indexes for search and filtering
CREATE INDEX idx_products_name_lower ON products (lower(name));
CREATE INDEX idx_products_category   ON products (category_id);
