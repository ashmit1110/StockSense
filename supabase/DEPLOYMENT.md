# StockSense — Backend Deployment Guide

## Prerequisites

1. A Supabase project (create at [supabase.com](https://supabase.com))
2. Access to the Supabase SQL Editor

## Step 1: Run Migrations

Run each migration file **in order** in the Supabase SQL Editor:

```
001_enums.sql
002_profiles.sql
003_categories.sql
004_warehouses.sql
005_products.sql
006_locations.sql
007_sequences.sql
008_operations.sql
009_operation_lines.sql
010_stock_balances.sql
011_stock_ledger.sql
012_updated_at_triggers.sql
013_rls_policies.sql
014_views.sql
015_rpcs.sql
016_seed_data.sql
```

> **IMPORTANT**: Run them one at a time in this exact order. Each depends on the previous ones.

## Step 2: Create Demo User

After running all migrations, create the demo user via Supabase Auth:

1. Go to **Authentication** → **Users** in the Supabase dashboard
2. Click **Add user** → **Create new user**
3. Email: `demo@stocksense.app`
4. Password: `StockSense2024!`
5. Check "Auto Confirm User"

The `handle_new_user` trigger will automatically create a `profiles` row.

## Step 3: Verify

Run `supabase/tests/backend_verification.sql` in the SQL Editor.

All 19 tests should pass.

## Step 4: Get Frontend Config

From the Supabase dashboard → **Settings** → **API**:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Share these with Developer B.

## Step 5: Generate Types (Optional)

If Supabase CLI is installed:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
```

## Architecture Summary

```
Frontend (React/Vite)
    ↓ supabase-js client
Supabase Platform
    ├── Auth (signup/login/logout/reset)
    ├── PostgREST (reads: tables + views)
    └── RPC (mutations: create/validate/cancel operations)
         ↓
PostgreSQL
    ├── 9 tables (profiles, categories, products, warehouses,
    │   locations, operations, operation_lines, stock_balances,
    │   stock_ledger)
    ├── 2 views (stock_with_free_to_use, move_history)
    ├── 7+ RPCs (create_operation, validate_operation, etc.)
    ├── RLS on all tables
    ├── CHECK(on_hand >= 0) — negative stock impossible
    └── Immutability trigger on stock_ledger
```

## RPC Quick Reference

| RPC | Purpose |
|---|---|
| `create_operation(type, lines, ...)` | Create any operation type |
| `update_operation(id, ...)` | Edit DRAFT operations |
| `mark_operation_ready(id)` | DRAFT/WAITING → READY |
| `cancel_operation(id)` | DRAFT/READY/WAITING → CANCELED |
| `validate_operation(id)` | READY → DONE (with stock/ledger mutation) |
| `update_stock_from_count(product, location, count, reason)` | Inline stock adjustment |
| `get_dashboard_summary()` | Dashboard KPIs |
| `get_product_stock(product_id)` | Product stock by location |
