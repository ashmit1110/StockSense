-- ============================================================
-- Migration 007: Reference Sequences
-- ============================================================
-- One global sequence per operation type for the numeric portion
-- of operation references (e.g. MAIN/IN/0001).
-- ============================================================

CREATE SEQUENCE receipt_ref_seq    START 1;
CREATE SEQUENCE delivery_ref_seq   START 1;
CREATE SEQUENCE transfer_ref_seq   START 1;
CREATE SEQUENCE adjustment_ref_seq START 1;
