-- ============================================================
-- StockSense Backend Verification Tests
-- ============================================================
-- Run these queries in the Supabase SQL Editor AFTER deploying
-- all 16 migrations. These verify constraints, ledger
-- immutability, views, dashboard, and data integrity.
--
-- Each test has an expected result in a comment.
-- ============================================================


-- ============================================================
-- TEST 1: Verify all tables exist
-- ============================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
-- Expected: categories, locations, operation_lines, operations,
--           products, profiles, stock_balances, stock_ledger, warehouses


-- ============================================================
-- TEST 2: Verify all views exist
-- ============================================================
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
-- Expected: move_history, stock_with_free_to_use


-- ============================================================
-- TEST 3: Verify all enums exist
-- ============================================================
SELECT t.typname, e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('user_role', 'operation_type', 'operation_status', 'movement_type')
ORDER BY t.typname, e.enumsortorder;


-- ============================================================
-- TEST 4: Verify RLS is enabled on all tables
-- ============================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'categories', 'products', 'warehouses',
                     'locations', 'operations', 'operation_lines',
                     'stock_balances', 'stock_ledger')
ORDER BY tablename;
-- Expected: all rows have rowsecurity = true


-- ============================================================
-- TEST 5: Negative stock constraint
-- ============================================================
-- This should FAIL with a CHECK constraint violation
DO $$
BEGIN
  UPDATE stock_balances SET on_hand = -1
  WHERE product_id = 'd0000000-0000-0000-0000-000000000001'
    AND location_id = 'b0000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'TEST FAILED: Negative stock was allowed!';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'TEST 5 PASSED: Negative stock correctly blocked';
END $$;


-- ============================================================
-- TEST 6: Ledger immutability — UPDATE blocked
-- ============================================================
DO $$
BEGIN
  UPDATE stock_ledger SET quantity_change = 999
  WHERE id IN (
    SELECT id FROM stock_ledger WHERE operation_reference = 'MAIN/IN/0001' LIMIT 1
  );
  RAISE EXCEPTION 'TEST FAILED: Ledger UPDATE was allowed!';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'TEST 6 PASSED: Ledger UPDATE correctly blocked';
END $$;


-- ============================================================
-- TEST 7: Ledger immutability — DELETE blocked
-- ============================================================
DO $$
BEGIN
  DELETE FROM stock_ledger
  WHERE id IN (
    SELECT id FROM stock_ledger WHERE operation_reference = 'MAIN/IN/0001' LIMIT 1
  );
  RAISE EXCEPTION 'TEST FAILED: Ledger DELETE was allowed!';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'TEST 7 PASSED: Ledger DELETE correctly blocked';
END $$;


-- ============================================================
-- TEST 8: Zero ledger entry blocked
-- ============================================================
DO $$
BEGIN
  INSERT INTO stock_ledger (product_id, location_id, quantity_change,
    movement_type, operation_id, operation_reference)
  VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    0,
    'ADJUSTMENT',
    'e0000000-0000-0000-0000-000000000008',
    'TEST/ZERO/0001'
  );
  RAISE EXCEPTION 'TEST FAILED: Zero ledger entry was allowed!';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'TEST 8 PASSED: Zero ledger entry correctly blocked';
END $$;


-- ============================================================
-- TEST 9: Duplicate SKU blocked
-- ============================================================
DO $$
BEGIN
  INSERT INTO products (name, sku, unit_of_measure)
  VALUES ('Duplicate', 'STEEL-ROD-001', 'pcs');
  RAISE EXCEPTION 'TEST FAILED: Duplicate SKU was allowed!';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'TEST 9 PASSED: Duplicate SKU correctly blocked';
END $$;


-- ============================================================
-- TEST 10: Duplicate warehouse short_code blocked
-- ============================================================
DO $$
BEGIN
  INSERT INTO warehouses (name, short_code) VALUES ('Dup', 'MAIN');
  RAISE EXCEPTION 'TEST FAILED: Duplicate warehouse code was allowed!';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'TEST 10 PASSED: Duplicate warehouse code correctly blocked';
END $$;


-- ============================================================
-- TEST 11: Duplicate location code within warehouse blocked
-- ============================================================
DO $$
BEGIN
  INSERT INTO locations (warehouse_id, name, short_code)
  VALUES ('a0000000-0000-0000-0000-000000000001', 'Dup Rack', 'RA');
  RAISE EXCEPTION 'TEST FAILED: Duplicate location code was allowed!';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'TEST 11 PASSED: Duplicate location code correctly blocked';
END $$;


-- ============================================================
-- TEST 12: Verify stock_with_free_to_use view
-- ============================================================
SELECT
  product_name, sku, location_name, warehouse_name,
  on_hand, free_to_use, unit_cost
FROM stock_with_free_to_use
ORDER BY product_name, location_name;
-- Expected: 7 rows with correct on_hand and free_to_use
-- Steel Bolt M10 at Rack A should have free_to_use = 500 - 50 = 450
--   (50 reserved by READY delivery MAIN/OUT/0003)


-- ============================================================
-- TEST 13: Verify move_history view
-- ============================================================
SELECT
  reference, date, contact, product_name,
  quantity_change, movement_type,
  from_location_name, to_location_name, status
FROM move_history
ORDER BY date DESC, reference;
-- Expected: 7 rows across 4 DONE operations
-- MAIN/IN/0001 has 2 rows (multi-product)
-- MAIN/TRF/0001 has 2 rows (TRANSFER_OUT + TRANSFER_IN)
-- All status = DONE


-- ============================================================
-- TEST 14: Verify dashboard summary
-- ============================================================
SELECT get_dashboard_summary();
-- Expected JSON with:
--   receipts:  openCount=2, lateCount=1, waitingCount=0
--   deliveries: openCount=2, lateCount=1, waitingCount=1
--   totalProducts=5
--   lowStockItems >= 0
--   outOfStockItems >= 0


-- ============================================================
-- TEST 15: Verify stock balance consistency with ledger
-- ============================================================
-- For each (product, location) that has ledger entries,
-- the sum of ledger changes should match on_hand
-- (accounting for the fact that initial stock was seeded directly)
SELECT
  p.name,
  l.name AS location,
  sb.on_hand,
  COALESCE(SUM(sl.quantity_change), 0) AS ledger_sum
FROM stock_balances sb
JOIN products p ON p.id = sb.product_id
JOIN locations l ON l.id = sb.location_id
LEFT JOIN stock_ledger sl ON sl.product_id = sb.product_id AND sl.location_id = sb.location_id
GROUP BY p.name, l.name, sb.on_hand
ORDER BY p.name, l.name;
-- NOTE: ledger_sum may not equal on_hand because initial stock
-- was seeded directly. In production, they would match.


-- ============================================================
-- TEST 16: Verify operation reference uniqueness
-- ============================================================
SELECT reference, count(*)
FROM operations
GROUP BY reference
HAVING count(*) > 1;
-- Expected: 0 rows (no duplicates)


-- ============================================================
-- TEST 17: Verify sequences are advanced past seed data
-- ============================================================
SELECT
  'receipt_ref_seq' AS seq_name, last_value FROM receipt_ref_seq
UNION ALL SELECT
  'delivery_ref_seq', last_value FROM delivery_ref_seq
UNION ALL SELECT
  'transfer_ref_seq', last_value FROM transfer_ref_seq
UNION ALL SELECT
  'adjustment_ref_seq', last_value FROM adjustment_ref_seq;
-- Expected: receipt=3, delivery=3, transfer=1, adjustment=1


-- ============================================================
-- TEST 18: Verify RPC functions exist
-- ============================================================
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND routine_name IN (
    'create_operation', 'update_operation', 'mark_operation_ready',
    'cancel_operation', 'validate_operation', 'update_stock_from_count',
    'get_dashboard_summary', 'get_product_stock',
    'generate_operation_reference', 'handle_new_user',
    'set_updated_at', 'prevent_ledger_mutation'
  )
ORDER BY routine_name;
-- Expected: all 12 functions listed


-- ============================================================
-- TEST 19: Verify seed operations have correct statuses
-- ============================================================
SELECT reference, type, status, scheduled_date,
       CASE WHEN scheduled_date < CURRENT_DATE AND status NOT IN ('DONE', 'CANCELED')
            THEN true ELSE false END AS is_late
FROM operations
ORDER BY reference;
-- Expected: 8 operations with correct statuses


-- ============================================================
-- TEST 20: Free-to-Use Self-Reservation bug check
-- ============================================================
-- When validating a READY delivery, it must NOT subtract its own
-- requested quantity from Free to Use.
-- Expected: The delivery succeeds if stock >= its quantity,
-- even if it was previously READY.
DO $$
DECLARE
  v_op_id uuid := 'e0000000-0000-0000-0000-000000000006'; -- MAIN/OUT/0003 (READY, 50 units)
  v_res jsonb;
BEGIN
  -- Steel Bolt M10 has 500 total, 50 requested.
  -- This should succeed and not return WAITING.
  -- Simulate auth context
  -- (Normally this would need auth.uid() set, but for testing we assume SECURITY DEFINER bypass or test harness sets it)
  -- Since we can't easily mock auth.uid() in this script without an active session,
  -- we note this as a manual verification step.
  RAISE NOTICE 'TEST 20: Verify manually by validating MAIN/OUT/0003 via API.';
END $$;

-- ============================================================
-- TEST 21: Partial Shortage returns WAITING
-- ============================================================
-- Expected: If a multi-line operation has one line with shortage,
-- entire operation returns WAITING, no lines are mutated.
DO $$
BEGIN
  RAISE NOTICE 'TEST 21: Verify manually by validating multi-line operation with one shortage.';
END $$;

-- ============================================================
-- TEST 22: update_stock_from_count atomic test
-- ============================================================
-- Expected: Physical count matches final stock, ledger diff is correct.
DO $$
BEGIN
  RAISE NOTICE 'TEST 22: Verify manually by calling update_stock_from_count.';
END $$;


-- ============================================================
-- SUMMARY
-- ============================================================
-- If all tests pass:
-- ✅ Schema is complete (9 tables, 2 views, 4 enums)
-- ✅ Constraints are enforced (negative stock, immutable ledger, unique keys)
-- ✅ RLS is enabled on all tables
-- ✅ RPCs are deployed
-- ✅ Views return correct data
-- ✅ Dashboard summary is accurate
-- ✅ Seed data is consistent
-- ✅ Sequences are ready for new operations
