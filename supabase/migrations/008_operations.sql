-- ============================================================
-- Migration 008: Operations
-- ============================================================
-- Polymorphic operations table: one row per Receipt, Delivery,
-- Transfer, or Adjustment. Type-specific constraints enforced
-- at RPC level for flexibility.
-- ============================================================

CREATE TABLE operations (
  id                      uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  type                    operation_type   NOT NULL,
  reference               text             NOT NULL UNIQUE,
  status                  operation_status NOT NULL DEFAULT 'DRAFT',
  scheduled_date          date             NOT NULL DEFAULT CURRENT_DATE,
  responsible_user_id     uuid             NULL REFERENCES profiles(id) ON DELETE SET NULL,
  partner_name            text             NULL,
  source_location_id      uuid             NULL REFERENCES locations(id) ON DELETE RESTRICT,
  destination_location_id uuid             NULL REFERENCES locations(id) ON DELETE RESTRICT,
  reason                  text             NULL,
  validated_at            timestamptz      NULL,
  canceled_at             timestamptz      NULL,
  created_by              uuid             NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              timestamptz      NOT NULL DEFAULT now(),
  updated_at              timestamptz      NOT NULL DEFAULT now()
);

-- Indexes for filtering and lookups
CREATE INDEX idx_operations_type_status  ON operations (type, status);
CREATE INDEX idx_operations_sched_date   ON operations (scheduled_date);
CREATE INDEX idx_operations_source_loc   ON operations (source_location_id);
CREATE INDEX idx_operations_dest_loc     ON operations (destination_location_id);
CREATE INDEX idx_operations_created_by   ON operations (created_by);
