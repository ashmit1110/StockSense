-- ============================================================
-- Migration 014: Views (Read Models)
-- ============================================================
-- stock_with_free_to_use: Stock screen + Free to Use calculation
-- move_history: Move History screen from immutable ledger
-- ============================================================

-- ==================== STOCK WITH FREE TO USE ====================
-- Free to Use = On Hand - reserved by READY Delivery/Transfer lines
-- at the source location.
CREATE OR REPLACE VIEW stock_with_free_to_use AS
SELECT
  sb.id              AS stock_balance_id,
  sb.product_id,
  p.name             AS product_name,
  p.sku,
  p.unit_cost,
  p.unit_of_measure,
  p.reorder_level,
  p.category_id,
  c.name             AS category_name,
  sb.location_id,
  l.name             AS location_name,
  l.short_code       AS location_short_code,
  l.warehouse_id,
  w.name             AS warehouse_name,
  w.short_code       AS warehouse_short_code,
  sb.on_hand,
  sb.on_hand - COALESCE(reserved.total_reserved, 0) AS free_to_use
FROM stock_balances sb
JOIN products p    ON p.id = sb.product_id
LEFT JOIN categories c ON c.id = p.category_id
JOIN locations l   ON l.id = sb.location_id
JOIN warehouses w  ON w.id = l.warehouse_id
LEFT JOIN (
  -- Sum quantities reserved by READY outgoing operations
  SELECT
    ol.product_id,
    o.source_location_id AS location_id,
    SUM(ol.quantity)      AS total_reserved
  FROM operation_lines ol
  JOIN operations o ON o.id = ol.operation_id
  WHERE o.type IN ('DELIVERY', 'TRANSFER')
    AND o.status = 'READY'
    AND o.source_location_id IS NOT NULL
  GROUP BY ol.product_id, o.source_location_id
) reserved
  ON  reserved.product_id  = sb.product_id
  AND reserved.location_id = sb.location_id;


-- ==================== MOVE HISTORY ====================
-- Read-only view over the immutable stock_ledger joined with
-- operation metadata. Returns one row per ledger entry.
-- From/To mapping follows the approved plan:
--   RECEIPT:      From=null, To=destination
--   DELIVERY:     From=source, To=null
--   TRANSFER_OUT: From=source, To=destination
--   TRANSFER_IN:  From=source, To=destination
--   ADJUSTMENT:   From=location, To=location
CREATE OR REPLACE VIEW move_history AS
SELECT
  sl.id                   AS ledger_id,
  sl.operation_id,
  sl.operation_reference  AS reference,
  sl.created_at           AS date,
  o.partner_name          AS contact,
  sl.product_id,
  p.name                  AS product_name,
  p.sku                   AS product_sku,
  sl.quantity_change,
  sl.movement_type,
  o.status,
  o.type                  AS operation_type,

  -- From location
  CASE
    WHEN sl.movement_type IN ('DELIVERY', 'TRANSFER_OUT', 'TRANSFER_IN')
      THEN o.source_location_id
    WHEN sl.movement_type = 'ADJUSTMENT'
      THEN o.destination_location_id
    ELSE NULL
  END AS from_location_id,

  CASE
    WHEN sl.movement_type IN ('DELIVERY', 'TRANSFER_OUT', 'TRANSFER_IN')
      THEN src_l.name
    WHEN sl.movement_type = 'ADJUSTMENT'
      THEN dst_l.name
    ELSE NULL
  END AS from_location_name,

  -- To location
  CASE
    WHEN sl.movement_type IN ('RECEIPT', 'TRANSFER_OUT', 'TRANSFER_IN')
      THEN o.destination_location_id
    WHEN sl.movement_type = 'ADJUSTMENT'
      THEN o.destination_location_id
    ELSE NULL
  END AS to_location_id,

  CASE
    WHEN sl.movement_type IN ('RECEIPT', 'TRANSFER_OUT', 'TRANSFER_IN')
      THEN dst_l.name
    WHEN sl.movement_type = 'ADJUSTMENT'
      THEN dst_l.name
    ELSE NULL
  END AS to_location_name

FROM stock_ledger sl
JOIN operations o  ON o.id  = sl.operation_id
JOIN products p    ON p.id  = sl.product_id
LEFT JOIN locations src_l ON src_l.id = o.source_location_id
LEFT JOIN locations dst_l ON dst_l.id = o.destination_location_id
ORDER BY sl.created_at DESC;
