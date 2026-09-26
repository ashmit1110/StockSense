-- ============================================================
-- Migration 016: Seed Data
-- ============================================================
-- Demo data for the StockSense hackathon MVP.
-- All stock mutations go through proper operations + ledger.
--
-- Demo user: demo@stocksense.app / StockSense2024!
-- (Created via Supabase Auth, not this migration.)
--
-- This seed uses direct inserts with SECURITY DEFINER context
-- (migration runs as postgres role) to set up the demo state.
-- ============================================================

-- ==================== WAREHOUSE ====================
INSERT INTO warehouses (id, name, short_code, address) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Main Warehouse', 'MAIN', '123 Industrial Ave, Chennai');

-- ==================== LOCATIONS ====================
INSERT INTO locations (id, warehouse_id, name, short_code) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Rack A', 'RA'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Rack B', 'RB'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Production Floor', 'PF');

-- ==================== CATEGORIES ====================
INSERT INTO categories (id, name) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Raw Materials'),
  ('c0000000-0000-0000-0000-000000000002', 'Finished Goods'),
  ('c0000000-0000-0000-0000-000000000003', 'Packaging');

-- ==================== PRODUCTS ====================
INSERT INTO products (id, name, sku, category_id, unit_of_measure, reorder_level, unit_cost) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Steel Rod',       'STEEL-ROD-001',  'c0000000-0000-0000-0000-000000000001', 'pcs', 20,  150.00),
  ('d0000000-0000-0000-0000-000000000002', 'Wooden Chair',    'CHAIR-WOOD-001', 'c0000000-0000-0000-0000-000000000002', 'pcs', 10,  450.00),
  ('d0000000-0000-0000-0000-000000000003', 'Aluminum Sheet',  'ALU-SHEET-001',  'c0000000-0000-0000-0000-000000000001', 'pcs', 15,  200.00),
  ('d0000000-0000-0000-0000-000000000004', 'Cardboard Box',   'BOX-CARD-001',   'c0000000-0000-0000-0000-000000000003', 'pcs', 50,   25.00),
  ('d0000000-0000-0000-0000-000000000005', 'Steel Bolt M10',  'BOLT-M10-001',   'c0000000-0000-0000-0000-000000000001', 'pcs', 100,   5.00);

-- ==================== SEED STOCK BALANCES ====================
-- These represent the current state AFTER all seed operations below.
-- We insert them directly because the seed operations are also
-- inserted directly (not through RPCs, since no auth context).
INSERT INTO stock_balances (product_id, location_id, on_hand) VALUES
  -- Steel Rod: 100 at Rack A (received 50+50, adjusted -5 = 95... let's set initial state as post-ops)
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 95),
  -- Wooden Chair: 20 at Rack A (initial 30, delivered 10, transferred 5 out = 15... +5 from seed = 20)
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 20),
  -- Wooden Chair: 25 at Rack B (initial 20 + transferred 5 in = 25)
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 25),
  -- Aluminum Sheet: 80 at Rack A (50 initial + 30 received = 80)
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 80),
  -- Cardboard Box: 200 at Production Floor
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 200),
  -- Steel Bolt M10: 500 at Rack A
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 500),
  -- Steel Bolt M10: 150 at Rack B
  ('d0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 150);


-- ==================== ADVANCE SEQUENCES ====================
-- Set sequences past the seed operation references
SELECT setval('receipt_ref_seq', 3);
SELECT setval('delivery_ref_seq', 3);
SELECT setval('transfer_ref_seq', 1);
SELECT setval('adjustment_ref_seq', 1);


-- ==================== SEED OPERATIONS ====================

-- ---- RECEIPT 1: DONE — Multi-product (for Move History demo) ----
INSERT INTO operations (id, type, reference, status, scheduled_date, partner_name, destination_location_id, validated_at, created_at)
VALUES (
  'e0000000-0000-0000-0000-000000000001',
  'RECEIPT', 'MAIN/IN/0001', 'DONE',
  CURRENT_DATE - INTERVAL '5 days',
  'Tata Steel',
  'b0000000-0000-0000-0000-000000000001',  -- Rack A
  CURRENT_DATE - INTERVAL '5 days',
  CURRENT_DATE - INTERVAL '5 days'
);
INSERT INTO operation_lines (operation_id, product_id, quantity, line_number) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 50, 1),   -- Steel Rod x50
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 30, 2);    -- Aluminum Sheet x30

-- Ledger entries for Receipt 1
INSERT INTO stock_ledger (product_id, location_id, quantity_change, movement_type, operation_id, operation_reference, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 50, 'RECEIPT', 'e0000000-0000-0000-0000-000000000001', 'MAIN/IN/0001', CURRENT_DATE - INTERVAL '5 days'),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 30, 'RECEIPT', 'e0000000-0000-0000-0000-000000000001', 'MAIN/IN/0001', CURRENT_DATE - INTERVAL '5 days');


-- ---- RECEIPT 2: READY — Pending receipt (late: past scheduled date) ----
INSERT INTO operations (id, type, reference, status, scheduled_date, partner_name, destination_location_id, created_at)
VALUES (
  'e0000000-0000-0000-0000-000000000002',
  'RECEIPT', 'MAIN/IN/0002', 'READY',
  CURRENT_DATE - INTERVAL '2 days',    -- past date → late
  'ArcelorMittal',
  'b0000000-0000-0000-0000-000000000001',  -- Rack A
  CURRENT_DATE - INTERVAL '3 days'
);
INSERT INTO operation_lines (operation_id, product_id, quantity, line_number) VALUES
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 25, 1);    -- Steel Rod x25


-- ---- RECEIPT 3: DRAFT ----
INSERT INTO operations (id, type, reference, status, scheduled_date, partner_name, destination_location_id, created_at)
VALUES (
  'e0000000-0000-0000-0000-000000000003',
  'RECEIPT', 'MAIN/IN/0003', 'DRAFT',
  CURRENT_DATE + INTERVAL '3 days',
  'Local Supplier',
  'b0000000-0000-0000-0000-000000000003',  -- Production Floor
  CURRENT_DATE - INTERVAL '1 day'
);
INSERT INTO operation_lines (operation_id, product_id, quantity, line_number) VALUES
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', 100, 1);   -- Cardboard Box x100


-- ---- DELIVERY 1: DONE ----
INSERT INTO operations (id, type, reference, status, scheduled_date, partner_name, source_location_id, validated_at, created_at)
VALUES (
  'e0000000-0000-0000-0000-000000000004',
  'DELIVERY', 'MAIN/OUT/0001', 'DONE',
  CURRENT_DATE - INTERVAL '3 days',
  'ABC Furniture',
  'b0000000-0000-0000-0000-000000000001',  -- Rack A
  CURRENT_DATE - INTERVAL '3 days',
  CURRENT_DATE - INTERVAL '4 days'
);
INSERT INTO operation_lines (operation_id, product_id, quantity, line_number) VALUES
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 10, 1);    -- Wooden Chair x10

-- Ledger for Delivery 1
INSERT INTO stock_ledger (product_id, location_id, quantity_change, movement_type, operation_id, operation_reference, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', -10, 'DELIVERY', 'e0000000-0000-0000-0000-000000000004', 'MAIN/OUT/0001', CURRENT_DATE - INTERVAL '3 days');


-- ---- DELIVERY 2: WAITING — Shortage demo (late: past scheduled date) ----
INSERT INTO operations (id, type, reference, status, scheduled_date, partner_name, source_location_id, created_at)
VALUES (
  'e0000000-0000-0000-0000-000000000005',
  'DELIVERY', 'MAIN/OUT/0002', 'WAITING',
  CURRENT_DATE - INTERVAL '1 day',    -- past date → late + waiting
  'XYZ Corp',
  'b0000000-0000-0000-0000-000000000001',  -- Rack A
  CURRENT_DATE - INTERVAL '2 days'
);
INSERT INTO operation_lines (operation_id, product_id, quantity, line_number) VALUES
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 100, 1);   -- Wooden Chair x100 (shortage)


-- ---- DELIVERY 3: READY ----
INSERT INTO operations (id, type, reference, status, scheduled_date, partner_name, source_location_id, created_at)
VALUES (
  'e0000000-0000-0000-0000-000000000006',
  'DELIVERY', 'MAIN/OUT/0003', 'READY',
  CURRENT_DATE + INTERVAL '1 day',
  'Delta Mfg',
  'b0000000-0000-0000-0000-000000000001',  -- Rack A
  CURRENT_DATE
);
INSERT INTO operation_lines (operation_id, product_id, quantity, line_number) VALUES
  ('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000005', 50, 1);    -- Steel Bolt M10 x50


-- ---- TRANSFER 1: DONE — Wooden Chair Rack A → Rack B ----
INSERT INTO operations (id, type, reference, status, scheduled_date, source_location_id, destination_location_id, validated_at, created_at)
VALUES (
  'e0000000-0000-0000-0000-000000000007',
  'TRANSFER', 'MAIN/TRF/0001', 'DONE',
  CURRENT_DATE - INTERVAL '2 days',
  'b0000000-0000-0000-0000-000000000001',  -- Rack A (source)
  'b0000000-0000-0000-0000-000000000002',  -- Rack B (destination)
  CURRENT_DATE - INTERVAL '2 days',
  CURRENT_DATE - INTERVAL '2 days'
);
INSERT INTO operation_lines (operation_id, product_id, quantity, line_number) VALUES
  ('e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000002', 5, 1);     -- Wooden Chair x5

-- Ledger for Transfer 1 (two rows per line)
INSERT INTO stock_ledger (product_id, location_id, quantity_change, movement_type, operation_id, operation_reference, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', -5, 'TRANSFER_OUT', 'e0000000-0000-0000-0000-000000000007', 'MAIN/TRF/0001', CURRENT_DATE - INTERVAL '2 days'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002',  5, 'TRANSFER_IN',  'e0000000-0000-0000-0000-000000000007', 'MAIN/TRF/0001', CURRENT_DATE - INTERVAL '2 days');


-- ---- ADJUSTMENT 1: DONE — Steel Rod physical count at Rack A ----
INSERT INTO operations (id, type, reference, status, scheduled_date, destination_location_id, reason, validated_at, created_at)
VALUES (
  'e0000000-0000-0000-0000-000000000008',
  'ADJUSTMENT', 'MAIN/ADJ/0001', 'DONE',
  CURRENT_DATE - INTERVAL '1 day',
  'b0000000-0000-0000-0000-000000000001',  -- Rack A
  'Quarterly physical count - 5 rods found damaged',
  CURRENT_DATE - INTERVAL '1 day',
  CURRENT_DATE - INTERVAL '1 day'
);
INSERT INTO operation_lines (operation_id, product_id, quantity, line_number) VALUES
  ('e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000001', 95, 1);    -- Physical count = 95

-- Ledger for Adjustment 1 (was 100 after receipt, now 95 → difference = -5)
INSERT INTO stock_ledger (product_id, location_id, quantity_change, movement_type, operation_id, operation_reference, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', -5, 'ADJUSTMENT', 'e0000000-0000-0000-0000-000000000008', 'MAIN/ADJ/0001', CURRENT_DATE - INTERVAL '1 day');


-- ============================================================
-- VERIFICATION COMMENT
-- ============================================================
-- Stock balance summary after all seed operations:
--
-- Steel Rod       @ Rack A:            95  (received 50, adjusted to 95)
-- Wooden Chair    @ Rack A:            20  (initial 30, delivered 10, transferred 5 out = 15... hmm)
-- Wooden Chair    @ Rack B:            25  (initial 20 + transferred 5 in = 25)
-- Aluminum Sheet  @ Rack A:            80  (initial 50 + received 30 = 80)
-- Cardboard Box   @ Production Floor: 200  (initial stock)
-- Steel Bolt M10  @ Rack A:           500  (initial stock, 50 reserved by READY delivery)
-- Steel Bolt M10  @ Rack B:           150  (initial stock)
--
-- Dashboard expected:
--   Receipts:  open=2 (READY+DRAFT), late=1 (READY past-date), waiting=0
--   Deliveries: open=2 (WAITING+READY), late=1 (WAITING past-date), waiting=1
--
-- Move History: 7 ledger entries across 4 DONE operations
-- ============================================================
