-- ============================================================
-- Migration 004: Warehouses
-- ============================================================

CREATE TABLE warehouses (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  short_code  text        NOT NULL UNIQUE,
  address     text        NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
