# 10 - Frontend/Backend Integration Contract

This document finalizes the integration contract for the StockSense frontend developer. The backend is frozen; the frontend must consume these endpoints exactly as described.

## 1. Security & RLS Rules

- **Direct client mutations are BLOCKED.** `stock_balances` and `stock_ledger` tables strictly enforce `SELECT` only. You cannot use Supabase `.insert()` or `.update()` on these tables. All mutations must use the provided `supabase.rpc()` functions below.
- **Service Role Key:** The `service_role` key MUST NEVER be exposed to the frontend or browser environment. The application uses only the `anon` / `publishable` key for client interaction.

## 2. Views (Read-Only)

Fetch stock and move history from these views using standard `supabase-js` selects:

### `stock_with_free_to_use`
Columns:
- `product_id` (uuid)
- `product_name` (text)
- `sku` (text)
- `category_name` (text)
- `location_id` (uuid)
- `location_name` (text)
- `warehouse_name` (text)
- `on_hand` (numeric)
- `free_to_use` (numeric) — *Always use this for availability checks!*
- `reorder_level` (numeric)

### `move_history`
Columns:
- `ledger_id` (uuid)
- `product_id` (uuid)
- `product_name` (text)
- `sku` (text)
- `movement_type` (text - RECEIPT, DELIVERY, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT)
- `quantity_change` (numeric - signed)
- `location_id` (uuid)
- `location_name` (text)
- `warehouse_name` (text)
- `operation_id` (uuid)
- `operation_reference` (text)
- `user_id` (uuid)
- `created_at` (timestamp)

## 3. Operation Reference Format

References are generated automatically by the backend. The format is:
`{WarehouseShortCode}/{IN|OUT|TRF|ADJ}/{0000}`
*(Example: `MAIN/IN/0001`)*
The frontend should never attempt to generate these references.

## 4. Required RPCs

All mutations must use the `supabase.rpc('function_name', { args })` method.

### Dashboard
```typescript
const { data, error } = await supabase.rpc('get_dashboard_summary');
```
*Returns an object with metrics for: `receipts` (openCount, lateCount, waitingCount), `deliveries` (openCount, lateCount, waitingCount), `totalProducts`, `totalStock`, `lowStockItems`, `outOfStockItems`, `pendingReceipts`, `pendingDeliveries`, `scheduledTransfers`.*

### Product Creation with Initial Stock
```typescript
await supabase.rpc('create_product_with_initial_stock', {
  p_name: string,
  p_sku: string,
  p_category_id: 'uuid',
  p_unit_of_measure: string,
  p_reorder_level: number,
  p_unit_cost: number,
  p_location_id?: 'uuid',
  p_initial_stock: number
});
```

### Update Stock (Adjustment)
```typescript
await supabase.rpc('update_stock_from_count', {
  p_product_id: 'uuid',
  p_location_id: 'uuid',
  p_physical_count: number,
  p_reason: string
});
```

### Operations
```typescript
// Create Operation (DRAFT)
await supabase.rpc('create_operation', {
  p_type: 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT',
  p_lines: [{ product_id: 'uuid', quantity: number }],
  p_partner_name?: string,
  p_scheduled_date?: 'YYYY-MM-DD',
  p_source_location_id?: 'uuid',
  p_destination_location_id?: 'uuid',
  p_reason?: string
});

// Update Operation
await supabase.rpc('update_operation', {
  p_operation_id: 'uuid',
  p_lines: [{ product_id: 'uuid', quantity: number }],
  p_partner_name?: string,
  p_scheduled_date?: 'YYYY-MM-DD',
  p_source_location_id?: 'uuid',
  p_destination_location_id?: 'uuid',
  p_reason?: string
});

// Mark Operation Ready
await supabase.rpc('mark_operation_ready', {
  p_operation_id: 'uuid'
});

// Cancel Operation
await supabase.rpc('cancel_operation', {
  p_operation_id: 'uuid'
});
```

### Validate Operation & WAITING Behavior (CRITICAL)
```typescript
const { data, error } = await supabase.rpc('validate_operation', {
  p_operation_id: 'uuid'
});
```
**WAITING Status Handling:**
If `data.status === 'WAITING'`, this is a **VALID BUSINESS RESULT** and not an API error. The operation state in the database becomes `WAITING` and `data.shortages` will contain an array of objects detailing the shortages (Product, Requested, Available).
- The frontend must NOT display a generic API error.
- The frontend must display the shortages to the user.
- The backend guarantees that NO stock or ledger mutation occurs when `WAITING` is returned.
