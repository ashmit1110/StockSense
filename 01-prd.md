# StockSense — Product Requirements Document (PRD)

> Hackathon MVP · 2 developers · 6 hours · React/Vite/TS + Supabase/Postgres

## 1. Product Overview
StockSense is a centralized Inventory Management System that replaces manual registers, spreadsheets, and scattered stock tracking with a single application covering incoming stock (Receipts), outgoing stock (Deliveries), internal movement (Transfers), and stock reconciliation (Adjustments), all backed by one append-only stock ledger.

## 2. Problem Statement
Teams tracking inventory across paper, spreadsheets, and memory have no single source of truth for what is in stock, where, or why it changed. This causes stockouts, overstock, lost items, and no accountability for who moved what. StockSense gives Inventory Managers and Warehouse Staff one system to record every stock movement and see accurate, real-time stock levels.

## 3. Goals
- One accurate, real-time view of stock across all warehouses/locations.
- Digitize receiving, delivering, transferring, and adjusting stock as first-class workflows.
- Guarantee stock accuracy via an immutable ledger and atomic stock mutations.
- Give managers an operational dashboard that surfaces exceptions (low stock, late, waiting).
- Ship a working, demoable product in 6 hours with two developers working in parallel with minimal file conflicts.

## 4. Non-Goals
- Multi-tenant SaaS billing/plans.
- Financial/accounting integration (COGS, invoicing, tax).
- Demand forecasting or automated purchase orders.
- Barcode/QR scanning hardware integration.
- Native mobile apps.
- Multi-currency / multi-language.
- A full reservation/allocation engine.

## 5. Target Users
1. **Inventory Managers** — manage incoming/outgoing stock, monitor inventory and operations, review stock history.
2. **Warehouse Staff** — perform transfers, pick/pack/prepare deliveries, receive stock, shelve stock, perform counts and adjustments.

## 6. User Roles
The MVP ships a single authenticated role, **Staff**, usable by both personas above — there is no permission difference in the UI. `profiles.role` exists in the schema (`manager` | `staff`, default `staff`) for forward compatibility but is **not enforced** anywhere in the MVP. See Architecture Decisions.

## 7. Core Workflows
1. Sign up / log in → redirected to Dashboard.
2. Create & validate a **Receipt** → destination stock increases.
3. Create & validate a **Delivery** → source stock decreases (blocked if insufficient).
4. Create & validate an **Internal Transfer** → stock moves between two locations, total unchanged.
5. Create & validate an **Adjustment** → stock reconciled to a physical count.
6. Browse **Stock** → on-hand / free-to-use per product × location.
7. Browse **Move History** → full, filterable stock ledger.
8. Manage **Warehouses** & **Locations**.
9. Manage **Products** & categories.

## 8. Functional Requirements
- **Auth**: signup, login, logout, OTP/email password reset, basic profile, redirect authenticated users to `/dashboard`.
- **Dashboard**: KPI snapshot + filterable recent-operations feed.
- **Products**: CRUD (no delete) + search/filter + inline stock visibility.
- **Stock**: per-product, per-location on-hand/free-to-use table.
- **Receipts / Deliveries / Transfers / Adjustments**: create → draft → validate → done, with cancellation before done.
- **Move History**: read-only, filterable, append-only ledger view.
- **Warehouses & Locations**: CRUD (no delete once stock exists).

## 9. Dashboard Requirements
KPIs shown:
| KPI | Definition |
|---|---|
| Total Products / Stock | Count of active products; sum of on-hand units company-wide |
| Low Stock items | Products where `on_hand ≤ reorder_level AND on_hand > 0` (company-wide on-hand) |
| Out of Stock items | Products where `on_hand = 0` (company-wide) |
| Pending Receipts | Receipts with status `DRAFT` or `READY` |
| Pending Deliveries | Deliveries with status `DRAFT`, `WAITING`, or `READY` |
| Scheduled Internal Transfers | Transfers with status `DRAFT`, `WAITING`, or `READY` |
| Recent operations | Latest operations of all types, newest first, filterable |

Operational summaries (Receipts and Deliveries each show):
- **# of operations** — count of non-`DONE`/non-`CANCELED` operations of that type
- **# late** — see definition below
- **# waiting** — count with status `WAITING`

**Canonical rules (must match exactly across the app):**
- **Late** := `scheduled_date < CURRENT_DATE AND status NOT IN ('DONE','CANCELED')`
- **Waiting** := `status = 'WAITING'` — set when an operation cannot proceed because required stock is unavailable at validation time (Deliveries and Transfers only).

**Dashboard filters** (apply to the Recent Operations feed and, where meaningful, the summary counts): Document type (Receipt/Delivery/Transfer/Adjustment), Status (Draft/Waiting/Ready/Done/Canceled), Warehouse, Location, Product category.

## 10. Product Requirements
Fields: Name, SKU/Code (unique, required), Category (FK, optional), Unit of Measure, Reorder Level (integer, default 0), optional Initial Stock + initial location (create-time only).
Capabilities: Create, Read, Update, Search by SKU/name, filter by category, inline stock visibility (current on-hand shown in list/detail).
Delete is **out of scope**; `is_active` flag reserved for a future soft-disable.

## 11. Stock Requirements
Stock screen columns (minimum): Product, Per Unit Cost, On Hand, Free to Use.
`Free to Use = On Hand − Reserved Quantity`.

**MVP simplification** (documented for internal consistency): the MVP does not implement a general reservation ledger. `Reserved Quantity` for a (product, location) is computed as the sum of quantities on outgoing lines (Delivery source / Transfer source) belonging to operations currently in status `READY` at that location. `DRAFT` and `WAITING` lines do not reserve stock; `DONE`/`CANCELED` lines never reserve (already applied or void). This keeps "Free to Use" meaningfully different from "On Hand" without a dedicated reservations table.

Stock is tracked by **(product, location)** — a product can exist in many locations simultaneously; company-wide on-hand for a product is the sum across all its locations.

Per the wireframe's explicit annotation on the Stock screen ("User must be able to update the stock from here"), Stock also exposes an inline **Update Stock** action per row: the user enters a new physical count for that product/location and the system creates **and immediately validates** a single-line Adjustment behind the scenes. This satisfies the wireframe's request for a direct-feeling correction while preserving Architectural Rule #10 ("UI must not directly manipulate stock") — the write still goes through `validate_operation` and produces a normal, auditable ledger entry.

## 12. Receipt Requirements
- Represents incoming goods from a vendor.
- Fields: reference (auto-generated, format `{WarehouseShortCode}/IN/{ID}`, e.g. `MAIN/IN/0001` — confirmed by the wireframe), "Receive From" (vendor/contact name, free text), scheduled date, responsible user, destination location, product lines (product, quantity).
- Status flow: `DRAFT → READY → DONE`; cancellation `DRAFT → CANCELED`, `READY → CANCELED`. The detail page shows this as a status stepper (`Draft → Ready → Done`), per the wireframe.
- Validating (`READY → DONE`) increases destination stock for every line and writes one `RECEIPT` ledger row per line, atomically.
- Only `DONE` affects stock. `CANCELED` never affects stock. A `DONE` receipt is immutable (no edit/cancel/re-validate); its "Print" action becomes available once `DONE`, per the wireframe's annotation.

## 13. Delivery Requirements
- Represents outgoing stock to a customer.
- Fields: reference (auto, format `{WarehouseShortCode}/OUT/{ID}`, e.g. `MAIN/OUT/0001`), "Delivery Address" (customer/contact name and/or address, free text), scheduled date, responsible user, source location, product lines (product, quantity).
- Status flow: `DRAFT ⇄ WAITING → READY → DONE`; cancellation from `DRAFT`, `WAITING`, or `READY` → `CANCELED`. The detail page shows this as a status stepper (`Draft → Waiting → Ready → Done`), per the wireframe.
- **Stock check on validation**: for every line, `requested quantity ≤ free_to_use` at the source location. If any line fails, the operation is set to `WAITING` (not `DONE`), the offending line(s) are highlighted in red, and the user sees a clear per-line "insufficient stock" alert — exactly as annotated on the wireframe ("Alert the notification & mark the line red if product is not in stock"). Validation does not error the whole request.
- Validating (`READY → DONE`) decreases source stock for every line and writes one `DELIVERY` ledger row per line, atomically. Stock must never go negative — this is enforced at the database layer, not just the UI.
- A `DONE` delivery is immutable; "Print" becomes available once `DONE`.

## 14. Transfer Requirements
- Moves stock between two company locations (can be within the same warehouse or across warehouses).
- Fields: reference (auto, format `{SourceWarehouseShortCode}/TRF/{ID}`), source location, destination location (must differ from source), scheduled date, responsible user, product lines (product, quantity).
- Status flow: identical shape to Delivery (`DRAFT ⇄ WAITING → READY → DONE`, cancellable before `DONE`), shown as the same status stepper.
- Stock check identical to Delivery (including the red-line/alert treatment for shortages), applied against the **source** location.
- Validating decreases source stock and increases destination stock for every line in the **same transaction**, writing two ledger rows per line: `TRANSFER_OUT` (source, negative) and `TRANSFER_IN` (destination, positive). Total company-wide stock for the product is unchanged.

## 15. Adjustment Requirements
- Reconciles recorded stock with a physical count at one location.
- Fields: reference (auto, format `{WarehouseShortCode}/ADJ/{ID}`), location, scheduled date, responsible user, reason (free text, encouraged but optional), product lines (product, physical count).
- Status flow: `DRAFT → READY → DONE`; cancellation `DRAFT/READY → CANCELED`. `WAITING` does not apply.
- On validation, per line: `difference = physical_count − current_on_hand_at_location`; `on_hand += difference`; one `ADJUSTMENT` ledger row is written with `quantity_change = difference` (signed). `physical_count` must be ≥ 0; a resulting negative on-hand is rejected (should not occur since physical_count ≥ 0 by construction).
- The Stock screen's inline "Update Stock" action (§11) is implemented as a single-line Adjustment created and validated in one step, at the same location/product the user clicked.

## 16. Ledger Requirements
- Every `DONE` operation line writes one or more immutable rows to `stock_ledger`.
- Minimum fields: timestamp, product, location, quantity_change (signed), movement_type, reference operation (id + human reference), user.
- Movement types: `RECEIPT`, `DELIVERY`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`.
- Append-only: no UI/API path updates or deletes ledger rows; enforced at the database level (see 05-database-schema.md, 07-backend-architecture.md).
- Move History is a read-only, filterable view over `stock_ledger`.

## 17. Warehouse/Location Requirements
- Warehouse fields: Name, Short Code (unique), Address.
- Location fields: Name, Short Code (unique within its warehouse), Warehouse (required parent FK).
- One warehouse → many locations; one location → exactly one warehouse.
- CRUD for both (no delete once any `stock_balances` row references the record — MVP simply blocks delete in that case).

## 18. Authentication Requirements
- Email + password signup/login via Supabase Auth. The wireframe's Signup screen shows separate "Login Id" and "Email Id" fields; the MVP collapses these into a single **Email** field (see Architecture Decisions §24) since Supabase Auth is email-based and a separate username layer isn't worth the hackathon time.
- Password reset via Supabase's email OTP/magic-link flow ("Forgot Password?" link on the Login screen, per the wireframe).
- Authenticated users hitting `/login` or `/signup` are redirected to `/dashboard`; unauthenticated users hitting any protected route are redirected to `/login`.
- Logout clears the session and redirects to `/login`.
- Basic profile page: display name (editable), email (read-only), avatar optional.

## 19. Search/Filter Requirements
- **Products**: search by name/SKU (case-insensitive, partial), filter by category.
- **Stock**: search by product name/SKU, filter by warehouse, location, category.
- **Operation lists** (Receipts/Deliveries/Transfers/Adjustments): filter by status, warehouse/location, scheduled date range; search by **reference or contact name** (vendor/customer), per the wireframe's search annotation. Lists also support a **List/Kanban view toggle** (kanban grouped by status), per the wireframe — List is the default.
- **Move History**: filter by product, location, movement type, date range.
- **Dashboard**: filter by document type, status, warehouse, location, category (Recent Operations feed).

## 20. MVP Scope

**MUST HAVE**
- Auth: signup, login, logout, password reset
- Dashboard with all KPIs, summaries, and filters specified above
- Products: create, read, update, search, category filter
- Warehouses & Locations: create, read, update
- Receipts: create, edit (draft), validate, cancel, list, detail
- Deliveries: create, edit (draft), validate w/ stock check, cancel, list, detail
- Transfers: create, edit (draft), validate w/ stock check, cancel, list, detail
- Adjustments: create, validate, cancel, list, detail
- Stock screen (on-hand / free-to-use per product × location), including the inline "Update Stock" action
- Move History (filterable ledger view)
- Atomic stock + ledger + status updates for every mutation; negative stock impossible
- Operation reference format `{WarehouseShortCode}/{IN|OUT|TRF|ADJ}/{ID}`, matching the wireframe

**SHOULD HAVE**
- Automatic `WAITING` detection at validation time, with shortage lines highlighted red
- Print-friendly view for Receipt/Delivery detail (browser print CSS)
- Profile edit page
- `role` field on profiles (unused for authorization)
- Search by contact name (not just reference) on operation lists

**NICE TO HAVE**
- Supabase Realtime updates on Dashboard/Stock
- CSV export of Move History
- Soft-disable (`is_active`) for products
- Kanban (by-status) view toggle on operation lists, alongside the default List view

**OUT OF SCOPE**
- Multi-role permissions/authorization
- Vendor/customer management module (CRM-style entities)
- Barcode/QR scanning
- Full reservation/allocation engine
- Multi-currency, multi-language
- Notifications beyond auth emails
- Mobile apps
- Deleting products/warehouses/locations
- Undo of a `DONE` operation (corrections happen via Adjustment)

## 21. Explicit Out-of-Scope Features
See "OUT OF SCOPE" above. Additionally out of scope for the 6-hour build: bulk CSV import of products, PDF generation (browser print is the "Print" affordance), analytics/BI beyond the Dashboard KPIs, audit trail on non-stock entities (e.g., who edited a product's name).

## 22. Success Criteria
- Sign up, log in, land on Dashboard.
- Create + validate a Receipt → Stock screen and Move History reflect the increase.
- Create a Delivery for more than free-to-use stock → correctly blocked/`WAITING` with a clear message.
- Create + validate a Delivery within available stock → stock decrements correctly.
- Create + validate a Transfer → both locations update correctly, two ledger rows written, company-wide total unchanged.
- Create + validate an Adjustment → stock reconciles to physical count with one signed ledger row.
- Dashboard KPIs (totals, low/out of stock, late/waiting) are accurate against the underlying data.
- Stock can never go negative under any validated operation.

## 23. Demo Scenario
1. Log in as the seeded demo user.
2. Dashboard: point out KPIs, late/waiting counts, recent operations, and filters.
3. Create a Receipt: 50 Steel Rods → Main Warehouse / Rack A; validate; show Stock screen +50.
4. Create a Delivery: 10 Chairs from Rack A; validate; show Stock screen −10 and the new Move History row.
5. Create a Delivery for an unavailable quantity (e.g., 1000 units) → show it staying `WAITING` with a clear per-line message.
6. Create a Transfer: 20 units Rack A → Rack B; validate; show both locations update and two ledger rows.
7. Create an Adjustment: system stock 50 → physical count 47; validate; show a −3 ledger row.
8. Open Move History, filter by product, and walk through the full trail from steps 3–7.

## 24. Architecture Decisions / Assumptions
1. **A wireframe image (`arch.png`) was supplied after the initial draft of this documentation** and has been used to correct/confirm every screen it depicts: Login, Signup, Dashboard, Stock, Warehouse, Location, Receipts (list + detail), Delivery (list + detail), and Move History. It confirms — and this document now reflects — exactly the 10 screens originally promised in the problem statement, **plus** Move History as a bonus. It does **not** contain a dedicated Transfer or Adjustment screen; those two remain designed by us, styled consistently with the Receipt/Delivery screens, as the original problem statement anticipated ("Study the wireframes carefully... Preserve the intended structure and workflow while allowing reasonable modern UI implementation").
2. **Operation reference format is `{WarehouseShortCode}/{OpCode}/{ID}`**, taken directly from the wireframe's explicit annotation ("`<Warehouse>/<Operation>/<ID>`, Warehouse = Id of warehouse, operation = IN/OUT, Id = auto incremental unique id"). The wireframe only shows `IN` (Receipt) and `OUT` (Delivery); we extend the same pattern consistently to `TRF` (Transfer) and `ADJ` (Adjustment) so all four types share one scheme. The sequence portion (`ID`) increments per `(warehouse, op_code)` pair, not globally — see `05-database-schema.md` §15.
3. **The wireframe's Signup screen shows both a "Login Id" and an "Email Id" field**; we collapse these into a single **Email** field for the MVP, since Supabase Auth is inherently email-based and building a separate username-to-email resolution layer is not worth the time in a 6-hour build. The Login screen's "Login Id" field is likewise treated as "Email".
4. **The Dashboard wireframe's Operations breakdown callout lists only "1. Receipt 2. Delivery 3. Adjustment"** (no Transfer) and shows large summary cards only for Receipt and Delivery. We keep Transfer as a full, distinct operation type (per the detailed, explicit TRANSFER requirements elsewhere in the problem statement, including its two-leg ledger behavior) but do not give it its own large Dashboard card, matching what the wireframe actually shows; its pending count still appears in the smaller KPI row ("Scheduled Internal Transfers"), and Adjustments are reachable the same way.
5. **The Delivery detail wireframe includes an "Operation Type" field** whose purpose is not explained anywhere in the problem statement or annotations. Rather than guess at unspecified behavior, this field is **intentionally omitted** from the MVP Delivery form; see Open Questions below if the team wants to define and add it later.
6. **Move History is kept as the immutable, read-only stock ledger** described in detail elsewhere in the problem statement (append-only, no status concept), even though the wireframe's Move History mockup shows a "Status" column and a list/kanban toggle "based on status." We judge the explicit, detailed ledger requirements (append-only, cannot be edited, one row per stock-affecting line) to be the more authoritative source where the two disagree, since the wireframe's status column looks like reused placeholder data from the Receipts/Delivery list template rather than an intentional ledger feature. We do adopt the wireframe's other Move History details: a **Contact** column, and colored quantity changes (incoming/positive = green, outgoing/negative = red). The List/Kanban-by-status toggle is instead applied to the Receipts/Deliveries/Transfers/Adjustments lists, where a status genuinely exists.
7. **Single user role in the MVP.** Two personas are described (Inventory Manager, Warehouse Staff) but no differentiated permissions are specified; both are modeled as one authenticated role. A `role` column exists on `profiles` for future use only.
8. **Reservations are simplified**, computed from `READY`-status outgoing lines rather than a dedicated reservation ledger (see §11). This is the smallest rule that keeps "Free to Use" internally consistent and distinct from "On Hand".
9. **Vendor/customer are free-text fields** (shown as "Receive From" / "Delivery Address" per the wireframe), not full entities — no `vendors`/`customers` tables, since no fields beyond a name were specified and a CRM module is out of scope.
10. **`WAITING` applies only to Delivery and Transfer**, never Receipt or Adjustment, since only outgoing/moving operations can be blocked by insufficient stock — confirmed by the wireframe's own status-progression note ("Draft: initial stage / Waiting: waiting for the out of stock product to be in / Ready: ready to deliver/receive / Done: received or delivered").
11. **Delete is out of scope** for Products/Warehouses/Locations; `is_active` is reserved in the schema for a cheap soft-disable if time allows.
12. **"Print"** is a browser print stylesheet on the operation detail page, not a generated PDF, and is only meaningful once an operation is `DONE`, per the wireframe's annotation ("Print the receipt once it's DONE").
13. **The Stock screen's inline "Update Stock" action** (added per the wireframe's explicit note) is implemented as a single-line Adjustment created and validated immediately, not a raw edit — see §11 and §15.

## 25. Open Questions
1. Should Warehouse Staff and Inventory Manager ever see different dashboards/navigation, or is one shared view acceptable? **Assumed: one shared view** for the hackathon — revisit if roles are built out post-hackathon.
2. Does per-unit cost need history (e.g., weighted average after receipts), or is a single editable `unit_cost` on `products` sufficient? **Assumed: single editable field, no costing history** — confirm only if the demo specifically needs cost trends.
3. What should the Delivery wireframe's "Operation Type" field actually control? No behavior for it is described anywhere. It has been left out of the MVP (see Architecture Decision #5) — if it should exist, please clarify what values/behavior it needs before it's built.
