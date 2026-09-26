-- ============================================================
-- Migration 003: Categories
-- ============================================================

CREATE TABLE categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);
