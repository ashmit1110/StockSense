# StockSense — User Stories & Acceptance Criteria (Wireframe-Aligned)

> `01-prd.md` is intentionally unchanged. These stories align the remaining documentation with the supplied `arch.png` wireframe while preserving the PRD's business rules.
>
> Wireframed screens: Login/Signup, Dashboard, Stock, Warehouse, Location, Move History, Receipt list/detail, Delivery list/detail. Transfers, Adjustments, and Products remain PRD requirements and reuse these patterns.

## Shared terminology

Statuses: `DRAFT`, `WAITING`, `READY`, `DONE`, `CANCELED`.

Operation types: `RECEIPT`, `DELIVERY`, `TRANSFER`, `ADJUSTMENT`.

Ledger movement types: `RECEIPT`, `DELIVERY`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`.

## Authentication

### US-001 — Sign up (P0)

- Signup visually contains Login Id, Email Id, Password, and Re-enter Password.
- Per the unchanged PRD, Login Id is backed by the email identity; no separate username system is introduced.
- Valid signup creates the Auth user/profile and redirects to `/dashboard`.
- Invalid/duplicate credentials show inline errors.
- Password confirmation must match.

### US-002 — Log in (P0)

- Login visually contains Login Id and Password.
- Valid credentials redirect to `/dashboard`.
- Invalid credentials show an inline error.
- Authenticated users opening `/login` are redirected to `/dashboard`.

### US-003 — Password reset (P0)

- Login exposes Forgot Password.
- Submit sends the Supabase reset flow and shows a generic confirmation.
- Valid reset link permits a new password.

### US-004 — Logout (P0)

- Logout clears the session and redirects to `/login`.
- Protected routes redirect unauthenticated users to `/login`.

## Dashboard

### US-010 — View operational dashboard (P0)

- Dashboard contains the two primary wireframe cards: **Receipt** and **Delivery**.
- Receipt card exposes a To Receive action/count and late/open operation information.
- Delivery card exposes a To Deliver action/count and late/waiting/open operation information.
- Dashboard provides access to available Stock and recent operation history.
- Late = `scheduled_date < today AND status NOT IN ('DONE','CANCELED')`.
- Waiting = `status = 'WAITING'`.

### US-011 — Navigate to operations (P0)

- Receipt card opens the Receipt operation list with the appropriate filter.
- Delivery card opens the Delivery operation list with the appropriate filter.

### US-012 — Open Stock from Dashboard (P0)

- Dashboard provides the wireframe-indicated path to Stock.
- Stock shows Product, Per Unit Cost, On Hand, Free to Use.

## Stock

### US-020 — View stock (P0)

- Stock is shown per product/location.
- Required columns match the wireframe: Product, Per Unit Cost, On Hand, Free to Use.
- Free to Use comes from the backend.

### US-021 — Update stock from Stock (P0)

- Each row exposes an Update Stock action because the wireframe explicitly requires it.
- User enters a new physical count.
- The action creates and validates a single-line Adjustment.
- Frontend never directly updates `stock_balances`.
- A normal signed `ADJUSTMENT` ledger entry is produced.

## Products

### US-030 — Manage products (P0)

- Product CRUD, search, category filter, and stock visibility remain required by the PRD.
- Because Products has no dedicated wireframe, use the same compact table/form shell as the supplied screens.

## Receipts

### US-040 — Receipt list (P0)

- List View is the default.
- List/Kanban toggle is visible.
- Search supports reference and contact/vendor.
- Filters include status, warehouse/location, scheduled date.
- Clicking a row opens Receipt detail.

### US-041 — Create Receipt (P0)

- `New` opens the Receipt form.
- Fields: generated reference, Receive From, Scheduled Date, Responsible, destination/location, Products.
- Product rows contain Product and Quantity.
- New Product/Add Product adds lines.
- New receipt starts `DRAFT`.

### US-042 — Receipt status progression (P0)

- Detail shows `Draft → Ready → Done`.
- Draft is editable.
- Ready means prepared to receive.
- Done means received and read-only.

### US-043 — Validate Receipt (P0)

- Detail exposes Validate.
- Validation increases destination stock atomically and writes `RECEIPT` ledger entries.
- Status becomes `DONE`.
- Replayed validation cannot double-apply stock.

### US-044 — Print Receipt (P1)

- Print is available on Receipt detail.
- Browser print output is clean and print-oriented.
- The wireframe specifically annotates printing after Done.

### US-045 — Cancel Receipt (P0)

- Draft/Ready receipts can be canceled.
- Cancel never changes stock/ledger.

## Deliveries

### US-050 — Delivery list (P0)

- List View is the default.
- List/Kanban toggle is visible.
- Search supports reference and contact/customer.
- Filters include status, warehouse/location, scheduled date.
- Clicking a row opens Delivery detail.

### US-051 — Create Delivery (P0)

- `New` opens Delivery detail/create.
- Fields match the wireframe: reference, Delivery Address, Scheduled Date, Responsible, Operation Type, Products.
- Product rows contain Product and Quantity.
- New Product/Add Product adds lines.
- New delivery starts `DRAFT`.
- The wireframe's Operation Type field is preserved visually; its business values are not invented because the supplied requirements do not define them.

### US-052 — Delivery status progression (P0)

- Detail shows `Draft → Waiting → Ready → Done`.
- Waiting represents insufficient stock at validation time.
- Done is immutable.

### US-053 — Delivery stock validation (P0)

- Validate checks every line against Free to Use at the source.
- If any line is short, status becomes/remains `WAITING`.
- Affected lines are visually marked and a clear shortage message is shown.
- No stock/ledger mutation occurs on the shortage path.
- If all lines are available, source stock decreases and `DELIVERY` ledger rows are written atomically.

### US-054 — Print Delivery (P1)

- Print is available on Delivery detail.
- Done delivery prints cleanly.

### US-055 — Cancel Delivery (P0)

- Draft/Waiting/Ready deliveries can be canceled.
- Cancellation never changes stock.

## Transfers

### US-060 — Manage Transfers (P0)

- Reuse the Receipt/Delivery operation-list shell.
- List View is default and List/Kanban is available.
- Detail includes source, destination, date, responsible, products, Validate, Cancel.
- Status flow follows the PRD's Delivery-like flow.
- Validation writes `TRANSFER_OUT` and `TRANSFER_IN` atomically.

## Adjustments

### US-070 — Manage Adjustments (P0)

- Reuse the operation list/detail shell.
- Detail includes location, date, responsible, optional reason, product, physical count.
- Validation sets stock to the physical count and writes signed `ADJUSTMENT`.
- Stock Update is implemented through this workflow.

## Move History

### US-080 — View Move History (P0)

- Opening Move History lands on List View by default.
- Table matches the wireframe: Reference, Date, Contact, From, To, Quantity, Status.
- Multiple products under one reference produce multiple rows.
- From/To are derived from operation context.
- Incoming quantities are positive/green; outgoing quantities are negative/red.
- Search supports reference/contact.

### US-081 — Move History view toggle (P1)

- List/Kanban control is available if implemented.
- List remains the default.
- Toggle never changes underlying ledger data.

### US-082 — Trace source operation (P1)

- Clicking a reference opens its originating operation detail where applicable.
- Transfer legs retain the same operation reference.

## Warehouses

### US-090 — Manage warehouse (P0)

- Form matches wireframe: Name, Short Code, Address.
- Short Code is unique.
- List/detail uses the common shell.

## Locations

### US-100 — Manage location (P0)

- Form matches wireframe: Name, Short Code, Warehouse.
- Location belongs to exactly one warehouse.
- Short Code is unique within its warehouse.
- Detail can show current stock.

## Profile

### US-110 — Profile menu (P1)

- Top-right profile control exposes My Profile and Logout.
- Profile contains editable display name plus read-only email/role.

## Cross-cutting

- Stock mutations are atomic and server-controlled.
- Ledger rows are immutable.
- Validated operations cannot create negative stock.
- Refresh reloads canonical state from the server.
- Lists/details have loading, empty, and error states.
