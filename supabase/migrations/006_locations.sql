-- ============================================================
-- Migration 006: Locations
-- ============================================================

CREATE TABLE locations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id  uuid        NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  name          text        NOT NULL,
  short_code    text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (warehouse_id, short_code)
);

-- Index for warehouse lookups
CREATE INDEX idx_locations_warehouse ON locations (warehouse_id);
