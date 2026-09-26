-- ============================================================
-- Migration 009: Operation Lines
-- ============================================================

CREATE TABLE operation_lines (
  id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id  uuid           NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  product_id    uuid           NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity      numeric(14,3)  NOT NULL CHECK (quantity >= 0),
  line_number   integer        NOT NULL DEFAULT 1,
  created_at    timestamptz    NOT NULL DEFAULT now()
);

-- Indexes for lookups
CREATE INDEX idx_oplines_operation ON operation_lines (operation_id);
CREATE INDEX idx_oplines_product   ON operation_lines (product_id);
