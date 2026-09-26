-- ============================================================
-- Migration 015: RPCs (Remote Procedure Calls)
-- ============================================================
-- All business-critical inventory mutation functions.
-- These are SECURITY DEFINER — they bypass RLS but explicitly
-- validate auth.uid() at the start of each function.
-- ============================================================


-- ============================================================
-- HELPER: Generate operation reference
-- ============================================================
CREATE OR REPLACE FUNCTION generate_operation_reference(
  p_type          operation_type,
  p_location_id   uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_short_code text;
  v_seq        bigint;
  v_op_code    text;
BEGIN
  -- Resolve warehouse short code from location
  SELECT w.short_code INTO v_short_code
  FROM locations l
  JOIN warehouses w ON w.id = l.warehouse_id
  WHERE l.id = p_location_id;

  IF v_short_code IS NULL THEN
    RAISE EXCEPTION 'INVALID_LOCATION'
      USING HINT = 'Location not found or has no warehouse';
  END IF;

  -- Get next sequence and op code
  CASE p_type
    WHEN 'RECEIPT' THEN
      v_seq := nextval('receipt_ref_seq');
      v_op_code := 'IN';
    WHEN 'DELIVERY' THEN
      v_seq := nextval('delivery_ref_seq');
      v_op_code := 'OUT';
    WHEN 'TRANSFER' THEN
      v_seq := nextval('transfer_ref_seq');
      v_op_code := 'TRF';
    WHEN 'ADJUSTMENT' THEN
      v_seq := nextval('adjustment_ref_seq');
      v_op_code := 'ADJ';
  END CASE;

  RETURN v_short_code || '/' || v_op_code || '/' || lpad(v_seq::text, 4, '0');
END;
$$;


-- ============================================================
-- 1. create_operation
-- ============================================================
CREATE OR REPLACE FUNCTION create_operation(
  p_type                    operation_type,
  p_lines                   jsonb,
  p_partner_name            text           DEFAULT NULL,
  p_scheduled_date          date           DEFAULT CURRENT_DATE,
  p_responsible_user_id     uuid           DEFAULT NULL,
  p_source_location_id      uuid           DEFAULT NULL,
  p_destination_location_id uuid           DEFAULT NULL,
  p_reason                  text           DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_op_id       uuid;
  v_reference   text;
  v_ref_loc_id  uuid;
  v_line        jsonb;
  v_line_num    integer := 0;
  v_product_id  uuid;
  v_quantity    numeric(14,3);
  v_result      jsonb;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING HINT = 'Authentication required';
  END IF;

  -- ======== Type-specific location validation ========
  IF p_type = 'RECEIPT' THEN
    IF p_destination_location_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = 'Destination location is required for Receipt';
    END IF;
    IF p_source_location_id IS NOT NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = 'Source location must be null for Receipt';
    END IF;
    v_ref_loc_id := p_destination_location_id;

  ELSIF p_type = 'DELIVERY' THEN
    IF p_source_location_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = 'Source location is required for Delivery';
    END IF;
    IF p_destination_location_id IS NOT NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = 'Destination location must be null for Delivery';
    END IF;
    v_ref_loc_id := p_source_location_id;

  ELSIF p_type = 'TRANSFER' THEN
    IF p_source_location_id IS NULL OR p_destination_location_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = 'Both source and destination locations are required for Transfer';
    END IF;
    IF p_source_location_id = p_destination_location_id THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = 'Source and destination must be different for Transfer';
    END IF;
    v_ref_loc_id := p_source_location_id;

  ELSIF p_type = 'ADJUSTMENT' THEN
    IF p_destination_location_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = 'Location (destination) is required for Adjustment';
    END IF;
    IF p_source_location_id IS NOT NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = 'Source location must be null for Adjustment';
    END IF;
    v_ref_loc_id := p_destination_location_id;
  END IF;

  -- Validate locations exist
  IF p_source_location_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM locations WHERE id = p_source_location_id) THEN
      RAISE EXCEPTION 'INVALID_LOCATION'
        USING HINT = 'Source location does not exist';
    END IF;
  END IF;
  IF p_destination_location_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM locations WHERE id = p_destination_location_id) THEN
      RAISE EXCEPTION 'INVALID_LOCATION'
        USING HINT = 'Destination location does not exist';
    END IF;
  END IF;

  -- Validate responsible user exists if specified
  IF p_responsible_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_responsible_user_id) THEN
      RAISE EXCEPTION 'NOT_FOUND'
        USING HINT = 'Responsible user not found';
    END IF;
  END IF;

  -- ======== Validate lines ========
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'
      USING HINT = 'At least one line is required';
  END IF;

  -- Pre-validate all lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_product_id := (v_line->>'product_id')::uuid;
    v_quantity   := (v_line->>'quantity')::numeric;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = 'Product ID is required for each line';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM products WHERE id = v_product_id) THEN
      RAISE EXCEPTION 'NOT_FOUND'
        USING HINT = format('Product %s not found', v_product_id);
    END IF;

    IF v_quantity IS NULL THEN
      RAISE EXCEPTION 'INVALID_QUANTITY'
        USING HINT = 'Quantity is required for each line';
    END IF;

    -- Receipt/Delivery/Transfer: quantity must be > 0
    -- Adjustment: quantity (physical count) must be >= 0
    IF p_type IN ('RECEIPT', 'DELIVERY', 'TRANSFER') AND v_quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY'
        USING HINT = 'Quantity must be greater than 0';
    END IF;
    IF p_type = 'ADJUSTMENT' AND v_quantity < 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY'
        USING HINT = 'Physical count must be >= 0';
    END IF;
  END LOOP;

  -- ======== Generate reference ========
  v_reference := generate_operation_reference(p_type, v_ref_loc_id);

  -- ======== Insert operation ========
  v_op_id := gen_random_uuid();

  INSERT INTO operations (
    id, type, reference, status, scheduled_date,
    responsible_user_id, partner_name,
    source_location_id, destination_location_id,
    reason, created_by
  ) VALUES (
    v_op_id, p_type, v_reference, 'DRAFT', p_scheduled_date,
    p_responsible_user_id, p_partner_name,
    p_source_location_id, p_destination_location_id,
    p_reason, v_user_id
  );

  -- ======== Insert lines ========
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_num := v_line_num + 1;
    INSERT INTO operation_lines (operation_id, product_id, quantity, line_number)
    VALUES (
      v_op_id,
      (v_line->>'product_id')::uuid,
      (v_line->>'quantity')::numeric,
      v_line_num
    );
  END LOOP;

  -- ======== Build result ========
  SELECT jsonb_build_object(
    'id', o.id,
    'type', o.type,
    'reference', o.reference,
    'status', o.status,
    'scheduledDate', o.scheduled_date,
    'partnerName', o.partner_name,
    'reason', o.reason,
    'sourceLocationId', o.source_location_id,
    'destinationLocationId', o.destination_location_id,
    'responsibleUserId', o.responsible_user_id,
    'createdBy', o.created_by,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'validatedAt', o.validated_at,
    'canceledAt', o.canceled_at,
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ol.id,
        'productId', ol.product_id,
        'productName', pr.name,
        'sku', pr.sku,
        'quantity', ol.quantity,
        'lineNumber', ol.line_number
      ) ORDER BY ol.line_number)
      FROM operation_lines ol
      JOIN products pr ON pr.id = ol.product_id
      WHERE ol.operation_id = o.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM operations o
  WHERE o.id = v_op_id;

  RETURN v_result;
END;
$$;


-- ============================================================
-- 2. update_operation
-- ============================================================
CREATE OR REPLACE FUNCTION update_operation(
  p_operation_id            uuid,
  p_lines                   jsonb          DEFAULT NULL,
  p_partner_name            text           DEFAULT NULL,
  p_scheduled_date          date           DEFAULT NULL,
  p_responsible_user_id     uuid           DEFAULT NULL,
  p_source_location_id      uuid           DEFAULT NULL,
  p_destination_location_id uuid           DEFAULT NULL,
  p_reason                  text           DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_op        record;
  v_line      jsonb;
  v_line_num  integer := 0;
  v_result    jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING HINT = 'Authentication required';
  END IF;

  -- Lock and fetch
  SELECT * INTO v_op
  FROM operations
  WHERE id = p_operation_id
  FOR UPDATE;

  IF v_op IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Operation not found';
  END IF;

  IF v_op.status = 'DONE' THEN
    RAISE EXCEPTION 'ALREADY_COMPLETED' USING HINT = 'Cannot edit a completed operation';
  END IF;
  IF v_op.status = 'CANCELED' THEN
    RAISE EXCEPTION 'ALREADY_CANCELED' USING HINT = 'Cannot edit a canceled operation';
  END IF;
  IF v_op.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'
      USING HINT = 'Only DRAFT operations can be edited';
  END IF;

  -- Update fields (only non-NULL params)
  UPDATE operations SET
    partner_name            = COALESCE(p_partner_name, partner_name),
    scheduled_date          = COALESCE(p_scheduled_date, scheduled_date),
    responsible_user_id     = COALESCE(p_responsible_user_id, responsible_user_id),
    reason                  = COALESCE(p_reason, reason)
  WHERE id = p_operation_id;

  -- Location updates (only if provided and type permits)
  IF p_source_location_id IS NOT NULL THEN
    IF v_op.type IN ('DELIVERY', 'TRANSFER') THEN
      IF NOT EXISTS (SELECT 1 FROM locations WHERE id = p_source_location_id) THEN
        RAISE EXCEPTION 'INVALID_LOCATION' USING HINT = 'Source location does not exist';
      END IF;
      UPDATE operations SET source_location_id = p_source_location_id WHERE id = p_operation_id;
    END IF;
  END IF;

  IF p_destination_location_id IS NOT NULL THEN
    IF v_op.type IN ('RECEIPT', 'TRANSFER', 'ADJUSTMENT') THEN
      IF NOT EXISTS (SELECT 1 FROM locations WHERE id = p_destination_location_id) THEN
        RAISE EXCEPTION 'INVALID_LOCATION' USING HINT = 'Destination location does not exist';
      END IF;
      UPDATE operations SET destination_location_id = p_destination_location_id WHERE id = p_operation_id;
    END IF;
  END IF;

  -- Validate transfer source != destination after location updates
  IF v_op.type = 'TRANSFER' THEN
    DECLARE
      v_src uuid;
      v_dst uuid;
    BEGIN
      SELECT source_location_id, destination_location_id INTO v_src, v_dst
      FROM operations WHERE id = p_operation_id;
      IF v_src = v_dst THEN
        RAISE EXCEPTION 'VALIDATION_ERROR'
          USING HINT = 'Source and destination must be different for Transfer';
      END IF;
    END;
  END IF;

  -- Replace lines if provided
  IF p_lines IS NOT NULL THEN
    IF jsonb_array_length(p_lines) = 0 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = 'At least one line is required';
    END IF;

    -- Delete existing lines
    DELETE FROM operation_lines WHERE operation_id = p_operation_id;

    -- Insert new lines
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
      v_line_num := v_line_num + 1;

      DECLARE
        v_pid uuid := (v_line->>'product_id')::uuid;
        v_qty numeric := (v_line->>'quantity')::numeric;
      BEGIN
        IF v_pid IS NULL OR NOT EXISTS (SELECT 1 FROM products WHERE id = v_pid) THEN
          RAISE EXCEPTION 'NOT_FOUND' USING HINT = format('Product %s not found', v_pid);
        END IF;

        IF v_op.type IN ('RECEIPT', 'DELIVERY', 'TRANSFER') AND v_qty <= 0 THEN
          RAISE EXCEPTION 'INVALID_QUANTITY' USING HINT = 'Quantity must be > 0';
        END IF;
        IF v_op.type = 'ADJUSTMENT' AND v_qty < 0 THEN
          RAISE EXCEPTION 'INVALID_QUANTITY' USING HINT = 'Physical count must be >= 0';
        END IF;

        INSERT INTO operation_lines (operation_id, product_id, quantity, line_number)
        VALUES (p_operation_id, v_pid, v_qty, v_line_num);
      END;
    END LOOP;
  END IF;

  -- Build and return result
  SELECT jsonb_build_object(
    'id', o.id,
    'type', o.type,
    'reference', o.reference,
    'status', o.status,
    'scheduledDate', o.scheduled_date,
    'partnerName', o.partner_name,
    'reason', o.reason,
    'sourceLocationId', o.source_location_id,
    'destinationLocationId', o.destination_location_id,
    'responsibleUserId', o.responsible_user_id,
    'createdBy', o.created_by,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'validatedAt', o.validated_at,
    'canceledAt', o.canceled_at,
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ol.id,
        'productId', ol.product_id,
        'productName', pr.name,
        'sku', pr.sku,
        'quantity', ol.quantity,
        'lineNumber', ol.line_number
      ) ORDER BY ol.line_number)
      FROM operation_lines ol
      JOIN products pr ON pr.id = ol.product_id
      WHERE ol.operation_id = o.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM operations o
  WHERE o.id = p_operation_id;

  RETURN v_result;
END;
$$;


-- ============================================================
-- 3. mark_operation_ready
-- ============================================================
CREATE OR REPLACE FUNCTION mark_operation_ready(p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_op         record;
  v_line_count integer;
  v_result     jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING HINT = 'Authentication required';
  END IF;

  SELECT * INTO v_op FROM operations WHERE id = p_operation_id FOR UPDATE;

  IF v_op IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Operation not found';
  END IF;
  IF v_op.status = 'DONE' THEN
    RAISE EXCEPTION 'ALREADY_COMPLETED' USING HINT = 'Operation is already done';
  END IF;
  IF v_op.status = 'CANCELED' THEN
    RAISE EXCEPTION 'ALREADY_CANCELED' USING HINT = 'Operation is already canceled';
  END IF;
  -- Allow DRAFT → READY and WAITING → READY (retry after shortage resolved)
  IF v_op.status NOT IN ('DRAFT', 'WAITING') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'
      USING HINT = format('Cannot mark %s operation as ready', v_op.status);
  END IF;

  -- Must have at least one line
  SELECT count(*) INTO v_line_count FROM operation_lines WHERE operation_id = p_operation_id;
  IF v_line_count = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR' USING HINT = 'Operation must have at least one line';
  END IF;

  UPDATE operations SET status = 'READY' WHERE id = p_operation_id;

  -- Build result
  SELECT jsonb_build_object(
    'id', o.id,
    'type', o.type,
    'reference', o.reference,
    'status', o.status,
    'scheduledDate', o.scheduled_date,
    'partnerName', o.partner_name,
    'reason', o.reason,
    'sourceLocationId', o.source_location_id,
    'destinationLocationId', o.destination_location_id,
    'responsibleUserId', o.responsible_user_id,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ol.id,
        'productId', ol.product_id,
        'productName', pr.name,
        'sku', pr.sku,
        'quantity', ol.quantity,
        'lineNumber', ol.line_number
      ) ORDER BY ol.line_number)
      FROM operation_lines ol
      JOIN products pr ON pr.id = ol.product_id
      WHERE ol.operation_id = o.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM operations o
  WHERE o.id = p_operation_id;

  RETURN v_result;
END;
$$;


-- ============================================================
-- 4. cancel_operation
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_operation(p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_op      record;
  v_result  jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING HINT = 'Authentication required';
  END IF;

  SELECT * INTO v_op FROM operations WHERE id = p_operation_id FOR UPDATE;

  IF v_op IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Operation not found';
  END IF;
  IF v_op.status = 'DONE' THEN
    RAISE EXCEPTION 'ALREADY_COMPLETED' USING HINT = 'Cannot cancel a completed operation';
  END IF;
  IF v_op.status = 'CANCELED' THEN
    RAISE EXCEPTION 'ALREADY_CANCELED' USING HINT = 'Operation is already canceled';
  END IF;

  -- Allowed: DRAFT, READY, WAITING → CANCELED
  IF v_op.status NOT IN ('DRAFT', 'READY', 'WAITING') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR'
      USING HINT = format('Cannot cancel operation with status %s', v_op.status);
  END IF;

  UPDATE operations
  SET status = 'CANCELED', canceled_at = now()
  WHERE id = p_operation_id;

  -- Build result
  SELECT jsonb_build_object(
    'id', o.id,
    'type', o.type,
    'reference', o.reference,
    'status', o.status,
    'scheduledDate', o.scheduled_date,
    'partnerName', o.partner_name,
    'reason', o.reason,
    'sourceLocationId', o.source_location_id,
    'destinationLocationId', o.destination_location_id,
    'responsibleUserId', o.responsible_user_id,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'validatedAt', o.validated_at,
    'canceledAt', o.canceled_at,
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ol.id,
        'productId', ol.product_id,
        'productName', pr.name,
        'sku', pr.sku,
        'quantity', ol.quantity,
        'lineNumber', ol.line_number
      ) ORDER BY ol.line_number)
      FROM operation_lines ol
      JOIN products pr ON pr.id = ol.product_id
      WHERE ol.operation_id = o.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM operations o
  WHERE o.id = p_operation_id;

  RETURN v_result;
END;
$$;


-- ============================================================
-- 5. validate_operation  ★ CRITICAL PATH ★
-- ============================================================
-- Handles all 4 operation types: Receipt, Delivery, Transfer,
-- Adjustment. This is the ONLY function that mutates stock and
-- writes ledger entries.
-- ============================================================
CREATE OR REPLACE FUNCTION validate_operation(p_operation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_op            record;
  v_line          record;
  v_current_oh    numeric(14,3);
  v_free_to_use   numeric(14,3);
  v_reserved      numeric(14,3);
  v_difference    numeric(14,3);
  v_has_shortage  boolean := false;
  v_shortages     jsonb := '[]'::jsonb;
  v_result        jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING HINT = 'Authentication required';
  END IF;

  -- ======== Lock operation row ========
  SELECT * INTO v_op FROM operations WHERE id = p_operation_id FOR UPDATE;

  IF v_op IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Operation not found';
  END IF;
  IF v_op.status = 'DONE' THEN
    RAISE EXCEPTION 'ALREADY_COMPLETED' USING HINT = 'Operation is already done';
  END IF;
  IF v_op.status = 'CANCELED' THEN
    RAISE EXCEPTION 'ALREADY_CANCELED' USING HINT = 'Operation is already canceled';
  END IF;

  -- Receipt/Adjustment: must be READY
  -- Delivery/Transfer: READY or WAITING (allow retry)
  IF v_op.type IN ('RECEIPT', 'ADJUSTMENT') THEN
    IF v_op.status <> 'READY' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = format('Operation must be READY to validate, current status: %s', v_op.status);
    END IF;
  ELSE
    IF v_op.status NOT IN ('READY', 'WAITING') THEN
      RAISE EXCEPTION 'VALIDATION_ERROR'
        USING HINT = format('Operation must be READY or WAITING to validate, current status: %s', v_op.status);
    END IF;
  END IF;

  -- ============================================================
  -- RECEIPT PATH
  -- ============================================================
  IF v_op.type = 'RECEIPT' THEN
    FOR v_line IN
      SELECT ol.*, p.name AS product_name, p.sku
      FROM operation_lines ol
      JOIN products p ON p.id = ol.product_id
      WHERE ol.operation_id = p_operation_id
      ORDER BY ol.line_number
    LOOP
      -- UPSERT stock balance: increase destination on_hand
      INSERT INTO stock_balances (product_id, location_id, on_hand)
      VALUES (v_line.product_id, v_op.destination_location_id, v_line.quantity)
      ON CONFLICT (product_id, location_id)
      DO UPDATE SET on_hand = stock_balances.on_hand + EXCLUDED.on_hand;

      -- Insert ledger row
      INSERT INTO stock_ledger (
        product_id, location_id, quantity_change,
        movement_type, operation_id, operation_reference, user_id
      ) VALUES (
        v_line.product_id,
        v_op.destination_location_id,
        v_line.quantity,
        'RECEIPT',
        p_operation_id,
        v_op.reference,
        v_user_id
      );
    END LOOP;

    -- Mark DONE
    UPDATE operations
    SET status = 'DONE', validated_at = now()
    WHERE id = p_operation_id;

  -- ============================================================
  -- DELIVERY PATH
  -- ============================================================
  ELSIF v_op.type = 'DELIVERY' THEN

    -- Step 1: Lock ALL relevant stock balance rows (deterministic order)
    PERFORM sb.id
    FROM stock_balances sb
    WHERE sb.location_id = v_op.source_location_id
      AND sb.product_id IN (
        SELECT ol.product_id FROM operation_lines ol WHERE ol.operation_id = p_operation_id
      )
    ORDER BY sb.product_id
    FOR UPDATE;

    -- Step 2: Check Free to Use for every line, collect ALL shortages
    FOR v_line IN
      SELECT ol.*, p.name AS product_name, p.sku
      FROM operation_lines ol
      JOIN products p ON p.id = ol.product_id
      WHERE ol.operation_id = p_operation_id
      ORDER BY ol.line_number
    LOOP
      -- Get current on_hand
      SELECT COALESCE(sb.on_hand, 0) INTO v_current_oh
      FROM stock_balances sb
      WHERE sb.product_id = v_line.product_id
        AND sb.location_id = v_op.source_location_id;

      IF v_current_oh IS NULL THEN
        v_current_oh := 0;
      END IF;

      -- Calculate reserved by OTHER READY outgoing operations (exclude self)
      SELECT COALESCE(SUM(ol2.quantity), 0) INTO v_reserved
      FROM operation_lines ol2
      JOIN operations o2 ON o2.id = ol2.operation_id
      WHERE o2.type IN ('DELIVERY', 'TRANSFER')
        AND o2.status = 'READY'
        AND o2.source_location_id = v_op.source_location_id
        AND ol2.product_id = v_line.product_id
        AND o2.id <> p_operation_id;  -- exclude self

      v_free_to_use := v_current_oh - v_reserved;

      IF v_line.quantity > v_free_to_use THEN
        v_has_shortage := true;
        v_shortages := v_shortages || jsonb_build_object(
          'productId', v_line.product_id,
          'productName', v_line.product_name,
          'sku', v_line.sku,
          'requested', v_line.quantity,
          'available', GREATEST(v_free_to_use, 0)
        );
      END IF;
    END LOOP;

    -- Step 3: Handle shortage or success
    IF v_has_shortage THEN
      -- Set WAITING, return shortages, NO stock/ledger mutation
      UPDATE operations SET status = 'WAITING' WHERE id = p_operation_id;

      SELECT jsonb_build_object(
        'id', o.id,
        'type', o.type,
        'reference', o.reference,
        'status', o.status,
        'scheduledDate', o.scheduled_date,
        'partnerName', o.partner_name,
        'reason', o.reason,
        'sourceLocationId', o.source_location_id,
        'destinationLocationId', o.destination_location_id,
        'responsibleUserId', o.responsible_user_id,
        'createdAt', o.created_at,
        'updatedAt', o.updated_at,
        'validatedAt', o.validated_at,
        'canceledAt', o.canceled_at,
        'lines', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ol.id,
            'productId', ol.product_id,
            'productName', pr.name,
            'sku', pr.sku,
            'quantity', ol.quantity,
            'lineNumber', ol.line_number
          ) ORDER BY ol.line_number)
          FROM operation_lines ol
          JOIN products pr ON pr.id = ol.product_id
          WHERE ol.operation_id = o.id
        ), '[]'::jsonb),
        'shortages', v_shortages
      ) INTO v_result
      FROM operations o WHERE o.id = p_operation_id;

      RETURN v_result;

    ELSE
      -- All lines available: mutate stock + write ledger
      FOR v_line IN
        SELECT ol.*, p.name AS product_name
        FROM operation_lines ol
        JOIN products p ON p.id = ol.product_id
        WHERE ol.operation_id = p_operation_id
        ORDER BY ol.line_number
      LOOP
        UPDATE stock_balances
        SET on_hand = on_hand - v_line.quantity
        WHERE product_id = v_line.product_id
          AND location_id = v_op.source_location_id;

        INSERT INTO stock_ledger (
          product_id, location_id, quantity_change,
          movement_type, operation_id, operation_reference, user_id
        ) VALUES (
          v_line.product_id,
          v_op.source_location_id,
          -v_line.quantity,
          'DELIVERY',
          p_operation_id,
          v_op.reference,
          v_user_id
        );
      END LOOP;

      UPDATE operations
      SET status = 'DONE', validated_at = now()
      WHERE id = p_operation_id;
    END IF;

  -- ============================================================
  -- TRANSFER PATH
  -- ============================================================
  ELSIF v_op.type = 'TRANSFER' THEN

    -- Lock source stock rows (deterministic order by product_id)
    PERFORM sb.id
    FROM stock_balances sb
    WHERE sb.location_id = v_op.source_location_id
      AND sb.product_id IN (
        SELECT ol.product_id FROM operation_lines ol WHERE ol.operation_id = p_operation_id
      )
    ORDER BY sb.product_id
    FOR UPDATE;

    -- Check Free to Use for every line (same as Delivery)
    FOR v_line IN
      SELECT ol.*, p.name AS product_name, p.sku
      FROM operation_lines ol
      JOIN products p ON p.id = ol.product_id
      WHERE ol.operation_id = p_operation_id
      ORDER BY ol.line_number
    LOOP
      SELECT COALESCE(sb.on_hand, 0) INTO v_current_oh
      FROM stock_balances sb
      WHERE sb.product_id = v_line.product_id
        AND sb.location_id = v_op.source_location_id;

      IF v_current_oh IS NULL THEN
        v_current_oh := 0;
      END IF;

      SELECT COALESCE(SUM(ol2.quantity), 0) INTO v_reserved
      FROM operation_lines ol2
      JOIN operations o2 ON o2.id = ol2.operation_id
      WHERE o2.type IN ('DELIVERY', 'TRANSFER')
        AND o2.status = 'READY'
        AND o2.source_location_id = v_op.source_location_id
        AND ol2.product_id = v_line.product_id
        AND o2.id <> p_operation_id;

      v_free_to_use := v_current_oh - v_reserved;

      IF v_line.quantity > v_free_to_use THEN
        v_has_shortage := true;
        v_shortages := v_shortages || jsonb_build_object(
          'productId', v_line.product_id,
          'productName', v_line.product_name,
          'sku', v_line.sku,
          'requested', v_line.quantity,
          'available', GREATEST(v_free_to_use, 0)
        );
      END IF;
    END LOOP;

    IF v_has_shortage THEN
      UPDATE operations SET status = 'WAITING' WHERE id = p_operation_id;

      SELECT jsonb_build_object(
        'id', o.id,
        'type', o.type,
        'reference', o.reference,
        'status', o.status,
        'scheduledDate', o.scheduled_date,
        'partnerName', o.partner_name,
        'reason', o.reason,
        'sourceLocationId', o.source_location_id,
        'destinationLocationId', o.destination_location_id,
        'responsibleUserId', o.responsible_user_id,
        'createdAt', o.created_at,
        'updatedAt', o.updated_at,
        'validatedAt', o.validated_at,
        'canceledAt', o.canceled_at,
        'lines', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ol.id,
            'productId', ol.product_id,
            'productName', pr.name,
            'sku', pr.sku,
            'quantity', ol.quantity,
            'lineNumber', ol.line_number
          ) ORDER BY ol.line_number)
          FROM operation_lines ol
          JOIN products pr ON pr.id = ol.product_id
          WHERE ol.operation_id = o.id
        ), '[]'::jsonb),
        'shortages', v_shortages
      ) INTO v_result
      FROM operations o WHERE o.id = p_operation_id;

      RETURN v_result;

    ELSE
      -- Mutate: source decrease, destination increase, two ledger rows per line
      FOR v_line IN
        SELECT ol.*, p.name AS product_name
        FROM operation_lines ol
        JOIN products p ON p.id = ol.product_id
        WHERE ol.operation_id = p_operation_id
        ORDER BY ol.line_number
      LOOP
        -- Decrease source
        UPDATE stock_balances
        SET on_hand = on_hand - v_line.quantity
        WHERE product_id = v_line.product_id
          AND location_id = v_op.source_location_id;

        -- Increase destination (UPSERT)
        INSERT INTO stock_balances (product_id, location_id, on_hand)
        VALUES (v_line.product_id, v_op.destination_location_id, v_line.quantity)
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET on_hand = stock_balances.on_hand + EXCLUDED.on_hand;

        -- Ledger: TRANSFER_OUT at source (negative)
        INSERT INTO stock_ledger (
          product_id, location_id, quantity_change,
          movement_type, operation_id, operation_reference, user_id
        ) VALUES (
          v_line.product_id,
          v_op.source_location_id,
          -v_line.quantity,
          'TRANSFER_OUT',
          p_operation_id,
          v_op.reference,
          v_user_id
        );

        -- Ledger: TRANSFER_IN at destination (positive)
        INSERT INTO stock_ledger (
          product_id, location_id, quantity_change,
          movement_type, operation_id, operation_reference, user_id
        ) VALUES (
          v_line.product_id,
          v_op.destination_location_id,
          v_line.quantity,
          'TRANSFER_IN',
          p_operation_id,
          v_op.reference,
          v_user_id
        );
      END LOOP;

      UPDATE operations
      SET status = 'DONE', validated_at = now()
      WHERE id = p_operation_id;
    END IF;

  -- ============================================================
  -- ADJUSTMENT PATH
  -- ============================================================
  ELSIF v_op.type = 'ADJUSTMENT' THEN
    FOR v_line IN
      SELECT ol.*, p.name AS product_name
      FROM operation_lines ol
      JOIN products p ON p.id = ol.product_id
      WHERE ol.operation_id = p_operation_id
      ORDER BY ol.line_number
    LOOP
      -- Get current on_hand (create balance row if missing, with on_hand = 0)
      INSERT INTO stock_balances (product_id, location_id, on_hand)
      VALUES (v_line.product_id, v_op.destination_location_id, 0)
      ON CONFLICT (product_id, location_id) DO NOTHING;

      SELECT on_hand INTO v_current_oh
      FROM stock_balances
      WHERE product_id = v_line.product_id
        AND location_id = v_op.destination_location_id
      FOR UPDATE;

      -- Calculate difference: physical_count - current_on_hand
      v_difference := v_line.quantity - v_current_oh;

      IF v_difference <> 0 THEN
        -- Update stock to physical count
        UPDATE stock_balances
        SET on_hand = v_line.quantity
        WHERE product_id = v_line.product_id
          AND location_id = v_op.destination_location_id;

        -- Write signed ledger entry
        INSERT INTO stock_ledger (
          product_id, location_id, quantity_change,
          movement_type, operation_id, operation_reference, user_id
        ) VALUES (
          v_line.product_id,
          v_op.destination_location_id,
          v_difference,
          'ADJUSTMENT',
          p_operation_id,
          v_op.reference,
          v_user_id
        );
      END IF;
      -- If difference = 0, skip (no ledger entry needed, stock unchanged)
    END LOOP;

    UPDATE operations
    SET status = 'DONE', validated_at = now()
    WHERE id = p_operation_id;
  END IF;

  -- ======== Build final result ========
  SELECT jsonb_build_object(
    'id', o.id,
    'type', o.type,
    'reference', o.reference,
    'status', o.status,
    'scheduledDate', o.scheduled_date,
    'partnerName', o.partner_name,
    'reason', o.reason,
    'sourceLocationId', o.source_location_id,
    'destinationLocationId', o.destination_location_id,
    'responsibleUserId', o.responsible_user_id,
    'createdBy', o.created_by,
    'createdAt', o.created_at,
    'updatedAt', o.updated_at,
    'validatedAt', o.validated_at,
    'canceledAt', o.canceled_at,
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ol.id,
        'productId', ol.product_id,
        'productName', pr.name,
        'sku', pr.sku,
        'quantity', ol.quantity,
        'lineNumber', ol.line_number
      ) ORDER BY ol.line_number)
      FROM operation_lines ol
      JOIN products pr ON pr.id = ol.product_id
      WHERE ol.operation_id = o.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM operations o
  WHERE o.id = p_operation_id;

  RETURN v_result;
END;
$$;


-- ============================================================
-- 6. update_stock_from_count
-- ============================================================
-- Convenience RPC for the Stock screen's "Update Stock" action.
-- Creates a single-line Adjustment and immediately validates it.
-- ============================================================
CREATE OR REPLACE FUNCTION update_stock_from_count(
  p_product_id      uuid,
  p_location_id     uuid,
  p_physical_count  numeric,
  p_reason          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid;
  v_op_id       uuid;
  v_reference   text;
  v_result      jsonb;
  v_current_oh  numeric(14,3);
  v_difference  numeric(14,3);
  v_stock_info  jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING HINT = 'Authentication required';
  END IF;

  -- Validate inputs
  IF p_physical_count < 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY'
      USING HINT = 'Physical count must be >= 0';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING HINT = 'Product not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM locations WHERE id = p_location_id) THEN
    RAISE EXCEPTION 'INVALID_LOCATION' USING HINT = 'Location not found';
  END IF;

  -- Generate reference
  v_reference := generate_operation_reference('ADJUSTMENT', p_location_id);
  v_op_id := gen_random_uuid();

  -- Create the adjustment operation (DRAFT)
  INSERT INTO operations (
    id, type, reference, status, scheduled_date,
    destination_location_id, reason, created_by
  ) VALUES (
    v_op_id, 'ADJUSTMENT', v_reference, 'DRAFT', CURRENT_DATE,
    p_location_id, p_reason, v_user_id
  );

  -- Create single line (quantity = physical count)
  INSERT INTO operation_lines (operation_id, product_id, quantity, line_number)
  VALUES (v_op_id, p_product_id, p_physical_count, 1);

  -- Transition to READY
  UPDATE operations SET status = 'READY' WHERE id = v_op_id;

  -- ======== Inline adjustment validation (same logic as validate_operation) ========

  -- Ensure stock balance row exists
  INSERT INTO stock_balances (product_id, location_id, on_hand)
  VALUES (p_product_id, p_location_id, 0)
  ON CONFLICT (product_id, location_id) DO NOTHING;

  SELECT on_hand INTO v_current_oh
  FROM stock_balances
  WHERE product_id = p_product_id AND location_id = p_location_id
  FOR UPDATE;

  v_difference := p_physical_count - v_current_oh;

  IF v_difference <> 0 THEN
    UPDATE stock_balances
    SET on_hand = p_physical_count
    WHERE product_id = p_product_id AND location_id = p_location_id;

    INSERT INTO stock_ledger (
      product_id, location_id, quantity_change,
      movement_type, operation_id, operation_reference, user_id
    ) VALUES (
      p_product_id,
      p_location_id,
      v_difference,
      'ADJUSTMENT',
      v_op_id,
      v_reference,
      v_user_id
    );
  END IF;

  -- Mark DONE
  UPDATE operations
  SET status = 'DONE', validated_at = now()
  WHERE id = v_op_id;

  -- ======== Build result with operation + stock info ========
  SELECT jsonb_build_object(
    'operation', jsonb_build_object(
      'id', o.id,
      'type', o.type,
      'reference', o.reference,
      'status', o.status,
      'scheduledDate', o.scheduled_date,
      'reason', o.reason,
      'destinationLocationId', o.destination_location_id,
      'createdAt', o.created_at,
      'validatedAt', o.validated_at,
      'lines', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', ol.id,
          'productId', ol.product_id,
          'productName', pr.name,
          'sku', pr.sku,
          'quantity', ol.quantity,
          'lineNumber', ol.line_number
        ) ORDER BY ol.line_number)
        FROM operation_lines ol
        JOIN products pr ON pr.id = ol.product_id
        WHERE ol.operation_id = o.id
      ), '[]'::jsonb)
    ),
    'stock', jsonb_build_object(
      'productId', s.product_id,
      'locationId', s.location_id,
      'onHand', s.on_hand,
      'freeToUse', s.free_to_use
    )
  ) INTO v_result
  FROM operations o
  CROSS JOIN (
    SELECT product_id, location_id, on_hand, free_to_use
    FROM stock_with_free_to_use
    WHERE product_id = p_product_id AND location_id = p_location_id
  ) s
  WHERE o.id = v_op_id;

  -- If stock_with_free_to_use doesn't return a row (edge case), fall back
  IF v_result IS NULL THEN
    SELECT jsonb_build_object(
      'operation', jsonb_build_object(
        'id', o.id,
        'type', o.type,
        'reference', o.reference,
        'status', o.status,
        'validatedAt', o.validated_at
      ),
      'stock', jsonb_build_object(
        'productId', p_product_id,
        'locationId', p_location_id,
        'onHand', p_physical_count,
        'freeToUse', p_physical_count
      )
    ) INTO v_result
    FROM operations o WHERE o.id = v_op_id;
  END IF;

  RETURN v_result;
END;
$$;


-- ============================================================
-- 7. get_dashboard_summary
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'receipts', jsonb_build_object(
      'openCount', (
        SELECT count(*) FROM operations
        WHERE type = 'RECEIPT' AND status NOT IN ('DONE', 'CANCELED')
      ),
      'lateCount', (
        SELECT count(*) FROM operations
        WHERE type = 'RECEIPT'
          AND scheduled_date < CURRENT_DATE
          AND status NOT IN ('DONE', 'CANCELED')
      ),
      'waitingCount', (
        SELECT count(*) FROM operations
        WHERE type = 'RECEIPT' AND status = 'WAITING'
      )
    ),
    'deliveries', jsonb_build_object(
      'openCount', (
        SELECT count(*) FROM operations
        WHERE type = 'DELIVERY' AND status NOT IN ('DONE', 'CANCELED')
      ),
      'lateCount', (
        SELECT count(*) FROM operations
        WHERE type = 'DELIVERY'
          AND scheduled_date < CURRENT_DATE
          AND status NOT IN ('DONE', 'CANCELED')
      ),
      'waitingCount', (
        SELECT count(*) FROM operations
        WHERE type = 'DELIVERY' AND status = 'WAITING'
      )
    ),
    'totalProducts', (
      SELECT count(*) FROM products WHERE is_active = true
    ),
    'totalStock', (
      SELECT COALESCE(sum(on_hand), 0) FROM stock_balances
    ),
    'lowStockItems', (
      SELECT count(*) FROM (
        SELECT p.id
        FROM products p
        JOIN stock_balances sb ON sb.product_id = p.id
        WHERE p.is_active = true AND p.reorder_level > 0
        GROUP BY p.id, p.reorder_level
        HAVING sum(sb.on_hand) <= p.reorder_level AND sum(sb.on_hand) > 0
      ) low
    ),
    'outOfStockItems', (
      SELECT count(*) FROM (
        SELECT p.id
        FROM products p
        LEFT JOIN stock_balances sb ON sb.product_id = p.id
        WHERE p.is_active = true
        GROUP BY p.id
        HAVING COALESCE(sum(sb.on_hand), 0) = 0
      ) oos
    ),
    'pendingReceipts', (
      SELECT count(*) FROM operations
      WHERE type = 'RECEIPT' AND status IN ('DRAFT', 'READY')
    ),
    'pendingDeliveries', (
      SELECT count(*) FROM operations
      WHERE type = 'DELIVERY' AND status IN ('DRAFT', 'WAITING', 'READY')
    ),
    'scheduledTransfers', (
      SELECT count(*) FROM operations
      WHERE type = 'TRANSFER' AND status IN ('DRAFT', 'WAITING', 'READY')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ============================================================
-- HELPER: get_product_stock
-- ============================================================
CREATE OR REPLACE FUNCTION get_product_stock(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'locationId', sb.location_id,
    'locationName', l.name,
    'warehouseName', w.name,
    'onHand', sb.on_hand
  ) ORDER BY w.name, l.name), '[]'::jsonb)
  INTO v_result
  FROM stock_balances sb
  JOIN locations l ON l.id = sb.location_id
  JOIN warehouses w ON w.id = l.warehouse_id
  WHERE sb.product_id = p_product_id;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 8. create_product_with_initial_stock
-- ============================================================
CREATE OR REPLACE FUNCTION create_product_with_initial_stock(
  p_name            text,
  p_sku             text,
  p_category_id     uuid,
  p_unit_of_measure text,
  p_reorder_level   numeric,
  p_unit_cost       numeric,
  p_location_id     uuid,
  p_initial_stock   numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_user_id   uuid;
  v_product_id uuid;
  v_result    jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING HINT = 'Authentication required';
  END IF;

  IF p_initial_stock < 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING HINT = 'Initial stock must be >= 0';
  END IF;

  -- Create product
  INSERT INTO products (
    name, sku, category_id, unit_of_measure, reorder_level, unit_cost, created_by
  ) VALUES (
    p_name, p_sku, p_category_id, p_unit_of_measure, p_reorder_level, p_unit_cost, v_user_id
  ) RETURNING id INTO v_product_id;

  -- Apply initial stock via update_stock_from_count
  IF p_initial_stock > 0 THEN
    IF p_location_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR' USING HINT = 'Location required for initial stock > 0';
    END IF;

    -- Call our existing RPC for setting stock
    PERFORM update_stock_from_count(v_product_id, p_location_id, p_initial_stock, 'Initial stock on creation');
  END IF;

  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'sku', sku,
    'categoryId', category_id,
    'unitOfMeasure', unit_of_measure,
    'reorderLevel', reorder_level,
    'unitCost', unit_cost,
    'isActive', is_active,
    'createdAt', created_at,
    'updatedAt', updated_at
  ) INTO v_result
  FROM products
  WHERE id = v_product_id;

  RETURN v_result;
END;
$body$;
