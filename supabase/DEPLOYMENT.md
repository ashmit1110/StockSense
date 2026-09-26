# StockSense — Production Supabase Deployment Runbook

**Document Owner:** Developer S (Backend Owner)  
**Target Backend Commit:** `59ba072` (Contracts: `7b1677f`, App: `50fb25c`)  
**Backend Status:** FROZEN — Verified production implementation (migrations 001–016)

---

## 1. Supabase Project Prerequisites

1. A hosted Supabase project created at [supabase.com](https://supabase.com) (PostgreSQL 15+ engine).
2. Owner or Administrator access to the target Supabase project dashboard.
3. Access to either:
   - Supabase CLI via `npx supabase` (Node.js 18+ runtime), or
   - Supabase Dashboard **SQL Editor**.

---

## 2. How to Identify & Link the Target Supabase Project

### 2.1 Project Reference Identification
1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your target project.
3. Navigate to **Project Settings** → **General**.
4. Copy the **Reference ID** (e.g., `abcdefghijklmnopqrst`). This is your `<project-ref>`.
   - Your API URL follows the format: `https://<project-ref>.supabase.co`.

### 2.2 CLI Linking
Authenticate and link the local workspace to your remote Supabase project:

```bash
# 1. Login to Supabase CLI (if not already authenticated)
npx supabase login

# 2. Link your workspace to the target project reference
npx supabase link --project-ref <project-ref>
```

Alternatively, record the target project reference in [`supabase/config.json`](./config.json):
```json
{
  "projectId": "<project-ref>",
  "remotes": {}
}
```

---

## 3. Required Deployment Credentials & Access

To deploy migrations safely, you need:

1. **Supabase Access Token:** Either obtained interactively via `npx supabase login` or set in your environment as `SUPABASE_ACCESS_TOKEN`.
2. **Database Password:** Set when creating the Supabase project (used by CLI to connect to the pooled/direct PostgreSQL instance during `db push`).
3. **Database URL (Alternative direct connection):** Found in **Project Settings** → **Database** → **Connection string** (URI format: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`).

---

## 4. Migration Order (001 through 016)

Migrations are sequentially dependent and **must be applied in exact numerical order**:

| Step | File | Description | Dependencies |
|---|---|---|---|
| 1 | `001_enums.sql` | Core enums: `operation_type`, `operation_status`, `movement_type` | None |
| 2 | `002_profiles.sql` | User profiles table and `on_auth_user_created` trigger | `auth.users` |
| 3 | `003_categories.sql` | Product categories table | None |
| 4 | `004_warehouses.sql` | Warehouses table with unique short code | None |
| 5 | `005_products.sql` | Products catalog with SKU, reorder level, unit cost | `categories` |
| 6 | `006_locations.sql` | Inventory locations within warehouses | `warehouses` |
| 7 | `007_sequences.sql` | Reference number counters for `{WH}/{TYPE}/{0000}` format | `warehouses` |
| 8 | `008_operations.sql` | Inventory operations (Receipt, Delivery, Transfer, Adjustment) | `locations`, `profiles` |
| 9 | `009_operation_lines.sql` | Line items per operation | `operations`, `products` |
| 10 | `010_stock_balances.sql` | Location inventory balances with `CHECK (on_hand >= 0)` | `products`, `locations` |
| 11 | `011_stock_ledger.sql` | Append-only immutable movement audit trail | `products`, `locations`, `operations` |
| 12 | `012_updated_at_triggers.sql` | Automatic `updated_at` triggers for all mutable tables | Core tables |
| 13 | `013_rls_policies.sql` | Row Level Security policies (SELECT-only on stock/ledger) | All tables |
| 14 | `014_views.sql` | Analytical views: `stock_with_free_to_use`, `move_history` | Tables, enums |
| 15 | `015_rpcs.sql` | Authoritative transactional RPCs (`SECURITY DEFINER`) | Tables, views, sequences |
| 16 | `016_seed_data.sql` | Seed warehouses, locations, categories, and initial products | All schema objects |

---

## 5. Safe Migration Deployment Procedure

### Method A: Supabase CLI (`db push`) — Recommended
This applies all unapplied local migrations safely without touching already applied migrations or altering live data:

```bash
# 1. Verify connection status
npx supabase migration list

# 2. Push missing migrations safely to remote project
npx supabase db push
```

### Method B: Supabase Dashboard SQL Editor — Manual
If CLI credentials are unavailable or restricted:
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**.
2. Open each file in [`supabase/migrations/`](./migrations/) from `001_enums.sql` through `016_seed_data.sql`.
3. Paste the contents into the SQL Editor and click **Run**.
4. Confirm query execution succeeds with `Success. No rows returned` before executing the next migration file.

---

## 6. CRITICAL SAFETY: No Remote Database Reset

> [!CAUTION]
> **DO NOT RUN `supabase db reset` ON A LINKED OR REMOTE DATABASE.**
> 
> Running `supabase db reset --linked` or resetting the remote database:
> - Drops all PostgreSQL schemas and tables.
> - Destroys all registered user profiles and authentication accounts.
> - Obliterates existing stock balances and immutable audit ledgers.
> - Violates the frozen backend deployment safety contract.
>
> Always use **forward-only migrations** via `npx supabase db push` or sequential SQL execution.

---

## 7. Post-Deployment Verification

After migrations have been applied:
1. Open the Supabase Dashboard **SQL Editor**.
2. Run the automated verification test suite from [`supabase/tests/backend_verification.sql`](./tests/backend_verification.sql).
3. Confirm that all automated test assertions pass with zero errors.

---

## 8. Required Tables (9 Tables)

The target Supabase project must expose the following tables with Row Level Security enabled:

1. `profiles`: User profile data linked to `auth.users` via trigger.
2. `categories`: Product grouping categories.
3. `products`: Catalog items with `sku`, `category_id`, `unit_of_measure`, `reorder_level`, `unit_cost`.
4. `warehouses`: Physical warehouses with unique `short_code`.
5. `locations`: Storage locations inside warehouses.
6. `operations`: Inventory operations with lifecycle status (`DRAFT`, `WAITING`, `READY`, `DONE`, `CANCELED`).
7. `operation_lines`: Quantities and products assigned to each operation.
8. `stock_balances`: On-hand inventory per product and location with strict `CHECK (on_hand >= 0)`.
9. `stock_ledger`: Append-only immutable transaction log (enforced via trigger blocking `UPDATE` and `DELETE`).

---

## 9. Required Views (2 Views)

PostgREST schema cache must expose these two read-only views to authenticated users:

1. **`stock_with_free_to_use`**:
   - Primary frontend inventory source.
   - Computes `free_to_use = on_hand - reserved_ready_outgoing`.
   - Exposes: `product_id`, `product_name`, `sku`, `category_name`, `location_id`, `location_name`, `warehouse_name`, `on_hand`, `free_to_use`, `reorder_level`.
2. **`move_history`**:
   - Primary audit trail view for movement logs.
   - Exposes: `ledger_id`, `product_id`, `product_name`, `sku`, `movement_type`, `quantity_change`, `location_id`, `location_name`, `warehouse_name`, `operation_id`, `operation_reference`, `user_id`, `created_at`.

---

## 10. Required RPCs (8 Authoritative RPCs)

All mutations occur through these PostgreSQL `SECURITY DEFINER` functions:

1. **`create_operation(p_type, p_lines, p_partner_name, p_scheduled_date, p_source_location_id, p_destination_location_id, p_reason)`**:
   Creates operation in `DRAFT` state with server-generated reference `{WH}/{TYPE}/{0000}`.
2. **`mark_operation_ready(p_operation_id)`**:
   Transitions operation from `DRAFT` or `WAITING` to `READY`.
3. **`validate_operation(p_operation_id)`**:
   Validates and executes an operation.
   - **Contract Rule:** If stock is insufficient, returns `{ "status": "WAITING", "shortages": [...] }` with **no RPC error**. This is a normal, successful business outcome.
   - If stock is sufficient, transitions to `DONE`, updates `stock_balances`, and appends `stock_ledger` entries atomically.
4. **`update_stock_from_count(p_product_id, p_location_id, p_physical_count, p_reason)`**:
   Inline physical count adjustment that atomically updates on-hand stock and writes signed diff to the ledger.
5. **`create_product_with_initial_stock(p_name, p_sku, p_category_id, p_unit_of_measure, p_reorder_level, p_unit_cost, p_location_id, p_initial_stock)`**:
   Atomically inserts product and creates opening inventory balance.
6. **`update_operation(p_operation_id, p_lines, p_partner_name, p_scheduled_date, p_source_location_id, p_destination_location_id, p_reason)`**:
   Updates metadata and line items of a `DRAFT` operation.
7. **`cancel_operation(p_operation_id)`**:
   Transitions `DRAFT`, `WAITING`, or `READY` operations to `CANCELED`.
8. **`get_dashboard_summary()`**:
   Computes operational counts and KPIs for Receipts, Deliveries, and Stock alerts.

---

## 11. RLS & Security Verification

1. **Row Level Security:** Enabled on all 9 tables in migration `013_rls_policies.sql`.
2. **Mutation Barrier:** Authenticated clients have `SELECT` permission on `stock_balances` and `stock_ledger`, but direct `INSERT`, `UPDATE`, and `DELETE` are disallowed.
3. **RPC Security:** All mutating functions use `SECURITY DEFINER` with fixed `SET search_path = public` to avoid privilege escalation.
4. **Schema Cache Reload:** If objects are not immediately visible to PostgREST after deployment, reload the schema cache:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

---

## 12. Frontend Environment Variables

Configure the frontend client via `.env.local` in the project root:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-anon-key>
```

Both values are located in the Supabase Dashboard: **Project Settings** → **API**.

---

## 13. CRITICAL SECURITY: Never Expose Service Role

> [!WARNING]
> **NEVER EXPOSE `SUPABASE_SERVICE_ROLE_KEY` TO THE FRONTEND CLIENT.**
> 
> - The frontend application must use **only** `VITE_SUPABASE_ANON_KEY`.
> - The `service_role` key bypasses all Row Level Security policies and grants unrestricted administrative control over the entire database.
> - Never commit `.env` or `.env.local` to Git. Verify that `.gitignore` contains `.env*` rules.

---

## 14. Seed & Demo Data Considerations

1. **Seed Schema Data:** Migration `016_seed_data.sql` inserts standard categories (`Electronics`, `Apparel`, `Raw Materials`), warehouses (`Central Warehouse`, `Secondary Warehouse`), locations (`Stock`, `Shelf 1`, `Shelf 2`), and initial inventory items.
2. **Demo User Creation:**
   After applying migrations, create the verified demo user via Supabase Dashboard:
   - Navigate to **Authentication** → **Users** → **Add user** → **Create new user**.
   - Email: `demo@stocksense.app`
   - Password: `StockSense2024!`
   - Toggle **Auto Confirm User**: ON.
   - The `on_auth_user_created` trigger will automatically insert a matching profile in `public.profiles`.

---

## 15. Rollout & Integration Verification Checklist

Prior to signing off the backend deployment, verify each step:

- [ ] Target Supabase project confirmed and linked.
- [ ] Migrations `001` through `016` applied sequentially without errors.
- [ ] Post-deployment verification suite (`backend_verification.sql`) executes with 100% pass rate.
- [ ] 9 core tables visible and accessible.
- [ ] 2 views (`stock_with_free_to_use`, `move_history`) visible in PostgREST schema cache.
- [ ] 8 RPCs visible in PostgREST schema cache.
- [ ] Row Level Security active on all tables; direct client writes blocked on `stock_balances` and `stock_ledger`.
- [ ] Demo user `demo@stocksense.app` created and verified in Supabase Auth.
- [ ] Frontend `.env.local` populated with valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- [ ] Frontend successfully logs in and renders dashboard via `get_dashboard_summary()`.
- [ ] Frontend stock view queries `stock_with_free_to_use` without error.
- [ ] Delivery validation with shortage returns `WAITING` status and does not corrupt stock.
