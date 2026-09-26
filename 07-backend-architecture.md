# StockSense — Backend Architecture (Wireframe-Aligned)

## 1. Architecture Overview

Supabase remains the backend:

```text
React SPA
   |
   +-- PostgREST reads + RLS
   |
   +-- Postgres RPC mutations
            |
         PostgreSQL
            |
     stock_balances
     stock_ledger
     operations
```

No separate application server is required for the MVP.

## 2. Backend Responsibilities

Postgres is responsible for:

- schema constraints
- stock correctness
- operation lifecycle
- ledger creation
- reference generation
- Free to Use calculation
- Dashboard operational counts
- Move History read model
- RLS
- atomic validation

The frontend is responsible only for presentation and invoking the contracts.

## 3. Authentication

Supabase Auth handles:

- signup
- login
- logout
- password reset

`handle_new_user()` creates a matching `profiles` row.

The wireframe labels the credential field `Login Id`; the PRD's email-based auth decision remains in force.

## 4. Read Services

Expose read models through views/functions:

```text
stock_with_free_to_use
move_history
get_dashboard_summary(...)
get_product_stock(...)
```

Reads use RLS/security-invoker behavior.

## 5. Operation Creation

RPC:

```text
create_operation(p_type, p_payload)
```

Responsibilities:

1. validate type-specific fields
2. validate line quantities
3. resolve relevant warehouse for reference generation
4. generate reference
5. insert operation
6. insert operation lines
7. return the operation

No stock changes occur at creation.

## 6. Operation Update

RPC:

```text
update_operation(p_id, p_payload)
```

Only `DRAFT` operations can be edited.

Replace lines atomically.

No stock/ledger changes occur while Draft.

## 7. Mark Ready

RPC:

```text
mark_operation_ready(p_id)
```

Rules:

- must be Draft
- must have at least one line
- becomes Ready
- no stock changes

## 8. Free-to-Use

Free to Use is:

```text
On Hand - quantities reserved by READY Delivery/Transfer lines
```

Waiting operations do not reserve stock.

This is exposed to the Stock UI and Delivery/Transfer detail pages.

## 9. Validate Operation

One RPC:

```text
validate_operation(p_operation_id)
```

### Common first steps

```text
lock operation row
check existence
reject DONE
reject CANCELED
load lines
```

### Receipt

For each line:

```text
destination.on_hand += quantity
insert RECEIPT ledger row
```

Then:

```text
status = DONE
validated_at = now()
```

### Delivery

Before mutation:

1. lock source balances
2. calculate/check Free to Use for every line
3. collect all shortages

If shortages exist:

```text
status = WAITING
```

and return shortages.

No stock or ledger change occurs.

If no shortages:

```text
source.on_hand -= quantity
insert DELIVERY ledger row
status = DONE
```

### Transfer

Same shortage check against source.

On success:

```text
source.on_hand -= quantity
destination.on_hand += quantity

insert TRANSFER_OUT
insert TRANSFER_IN

status = DONE
```

Lock source rows in deterministic order before destination rows to reduce deadlock risk.

### Adjustment

For each line:

```text
difference = physical_count - current_on_hand
on_hand = physical_count
insert ADJUSTMENT ledger row with difference
```

Then status becomes Done.

## 10. Cancel Operation

RPC:

```text
cancel_operation(p_operation_id)
```

Allowed:

```text
DRAFT
READY
WAITING
```

Result:

```text
CANCELED
```

No stock/ledger changes.

## 11. Stock Update RPC

The wireframe explicitly requires updating stock from the Stock page.

Recommended RPC:

```text
update_stock_from_count(
  p_product_id uuid,
  p_location_id uuid,
  p_physical_count numeric,
  p_reason text default null
)
```

Implementation options:

- create a single-line Adjustment and call the same validation path; or
- use a shared internal adjustment function.

Required invariants:

- same ledger behavior as normal Adjustment
- same authorization
- same transaction
- no direct frontend stock mutation

## 12. Move History Read Model

The wireframe is not merely a raw ledger table. It expects:

```text
Reference
Date
Contact
From
To
Quantity
Status
```

Build `move_history` as a read-only view over the immutable ledger + operation metadata.

Example mapping:

```text
RECEIPT
  From = null
  To = destination
  Quantity = +qty

DELIVERY
  From = source
  To = null
  Quantity = -qty

TRANSFER_OUT
  From = source
  To = destination
  Quantity = -qty

TRANSFER_IN
  From = source
  To = destination
  Quantity = +qty

ADJUSTMENT
  From/To = adjusted location
  Quantity = signed difference
```

If an operation has multiple product lines, return one row per product movement.

This directly supports the wireframe note that one reference with multiple products should appear on multiple rows.

## 13. Move History Search

Search by:

- operation reference
- partner/contact

The backend should use indexed text searches where practical.

## 14. Reference Generation

Server-side only:

```text
Receipt    -> {WarehouseShortCode}/IN/{sequence}
Delivery   -> {WarehouseShortCode}/OUT/{sequence}
Transfer   -> {WarehouseShortCode}/TRF/{sequence}
Adjustment -> {WarehouseShortCode}/ADJ/{sequence}
```

The frontend never decides the reference.

## 15. RLS

MVP:

- authenticated users can read operational data
- authenticated users can create/update allowed records
- profile update restricted to current user
- no delete path for core inventory entities
- ledger insert/select only
- ledger update/delete denied

Mutation RPCs use `security definer` only where necessary and explicitly validate `auth.uid()`.

## 16. Ledger Immutability

Use both:

```text
RLS: no UPDATE/DELETE policy
+
BEFORE UPDATE OR DELETE trigger
```

Trigger:

```sql
raise exception 'stock_ledger rows are immutable';
```

## 17. Concurrency

For Delivery/Transfer:

- lock operation
- lock source stock rows
- evaluate all shortages
- mutate only if all lines are valid

Database constraint:

```sql
CHECK (on_hand >= 0)
```

remains the last line of defense.

## 18. Dashboard Query

`get_dashboard_summary(...)` computes:

```text
Receipt:
  open
  late
  waiting

Delivery:
  open
  late
  waiting
```

using the canonical PRD rules.

The exact sample values drawn in the wireframe are never hardcoded.

## 19. Realtime

Optional only.

If enabled:

- subscribe to operations/stock changes
- invalidate TanStack Query keys
- do not manually merge realtime payloads into stock state

## 20. Backend AI Rules

- Never mutate stock directly from the frontend.
- Never create a ledger row outside the controlled mutation path.
- Never implement a second Free-to-Use formula in React.
- Never invent a persisted meaning for Delivery's wireframe `Operation Type` without product clarification.
- Never change a previously applied migration; add a new migration.
- Update schema/API docs whenever a schema contract changes.
