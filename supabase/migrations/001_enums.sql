-- ============================================================
-- Migration 001: Core Enums
-- ============================================================
-- Creates the 4 PostgreSQL enum types used throughout the schema.
-- Must run before any table that references these types.
-- ============================================================

-- User role (forward compatibility; NOT enforced in MVP)
CREATE TYPE user_role AS ENUM ('manager', 'staff');

-- Operation type
CREATE TYPE operation_type AS ENUM ('RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT');

-- Operation status
CREATE TYPE operation_status AS ENUM ('DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED');

-- Ledger movement type
CREATE TYPE movement_type AS ENUM ('RECEIPT', 'DELIVERY', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT');
