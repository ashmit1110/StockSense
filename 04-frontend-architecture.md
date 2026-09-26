# StockSense — Frontend Architecture (Wireframe-Aligned)

## 1. Architecture

React + Vite + TypeScript SPA.

Core stack:

- React Router
- TanStack Query
- Tailwind CSS
- shadcn/ui primitives
- react-hook-form + Zod
- Supabase JS client, isolated inside `services/`

The frontend is responsible for rendering the wireframe's compact navigation, tables, forms, status actions, and feedback states. It does not own inventory business rules.

## 2. Wireframe-First UI Rules

1. Use a **top navigation/header**, not a persistent desktop sidebar, because the supplied wireframe repeatedly shows:
   `Dashboard | Operations | Products | Move History | Settings`.
2. `Settings` expands to Warehouses and Locations.
3. `Operations` contains Receipts, Deliveries, Transfers, and Adjustments.
4. Receipt and Delivery list pages default to **List View** and expose a List/Kanban toggle.
5. Operation lists support search by **reference/contact**, not just IDs.
6. Receipt and Delivery detail pages use the wireframe action row:
   `Validate | Print | Cancel`
   plus a visible status progression.
7. Stock uses the wireframe columns:
   `Product | Per Unit Cost | On Hand | Free to Use`
   and includes an **Update Stock** action.
8. Move History defaults to List View and exposes:
   `Reference | Date | Contact | From | To | Quantity | Status`.
9. Products, Transfers, and Adjustments reuse these patterns because the image does not supply dedicated screens.

## 3. Folder Structure

```text
src/
  app/
    App.tsx
    routes.tsx
    providers.tsx

  components/
    ui/
    shared/
      AppHeader.tsx
      TopNav.tsx
      PageHeader.tsx
      SearchBar.tsx
      FilterBar.tsx
      ViewToggle.tsx
      DataTable.tsx
      KanbanBoard.tsx
      StatusBadge.tsx
      StatusStepper.tsx
      EmptyState.tsx
      ErrorState.tsx
      LoadingSkeleton.tsx
      ConfirmDialog.tsx
      QuantityCell.tsx
      MovementQuantityCell.tsx
      OperationActionBar.tsx
    forms/
      ProductLineEditor.tsx
      OperationForm.tsx

  features/
    auth/
    dashboard/
    products/
    stock/
    operations/
      shared/
      receipts/
      deliveries/
      transfers/
      adjustments/
    move-history/
    settings/
      warehouses/
      locations/
    profile/

  services/
    supabaseClient.ts
    authService.ts
    productService.ts
    categoryService.ts
    warehouseService.ts
    locationService.ts
    stockService.ts
    dashboardService.ts
    operationService.ts
    receiptService.ts
    deliveryService.ts
    transferService.ts
    adjustmentService.ts
    ledgerService.ts

  hooks/
    useDebouncedValue.ts
    usePagination.ts
    useViewMode.ts

  lib/
    queryKeys.ts
    formatters.ts
    validators.ts
    status.ts

  types/
    database.types.ts
    domain.ts
```

## 4. Route Structure

```text
/                           -> /dashboard or /login
/login
/signup
/forgot-password
/reset-password

/dashboard

/products
/products/new
/products/:id

/stock

/operations/receipts
/operations/receipts/new
/operations/receipts/:id

/operations/deliveries
/operations/deliveries/new
/operations/deliveries/:id

/operations/transfers
/operations/transfers/new
/operations/transfers/:id

/operations/adjustments
/operations/adjustments/new
/operations/adjustments/:id

/move-history

/settings/warehouses
/settings/warehouses/new
/settings/warehouses/:id

/settings/locations
/settings/locations/new
/settings/locations/:id

/profile
```

Protected routes are wrapped in `ProtectedRoute`.

## 5. Application Shell

### `AppHeader`

Responsibilities:

- application name/logo
- top navigation
- active route state
- profile/avatar control

Navigation:

```text
Dashboard
Operations
Products
Move History
Settings
```

Settings dropdown:

```text
Warehouses
Locations
```

Operations dropdown:

```text
Receipts
Deliveries
Transfers
Adjustments
```

Do not introduce a permanent left sidebar unless the visual design is deliberately changed later.

## 6. Shared Operation Architecture

The four operation types share:

- list table
- search/filter row
- List/Kanban toggle
- detail header
- status stepper
- action bar
- line-item editor
- confirmation dialogs

Use an `OperationConfig`:

```ts
type OperationConfig = {
  type: OperationType;
  title: string;
  listColumns: ColumnDef[];
  detailFields: FieldConfig[];
  statusFlow: OperationStatus[];
  supportsWaiting: boolean;
  supportsPrint: boolean;
};
```

This keeps Receipt/Delivery/Transfer/Adjustment behavior consistent without forcing unrelated domain rules into one component.

## 7. List View Architecture

Default:

```text
PageHeader
Search + Filters + ViewToggle
DataTable
```

`ViewToggle`:

```text
[ List ] [ Kanban ]
```

List mode is always the default for operation lists and Move History.

Search semantics:

- reference
- contact/vendor/customer where available

Filters:

- status
- warehouse/location
- scheduled date
- category/product where meaningful

## 8. Kanban Architecture

Kanban is a presentation of the same query result.

Columns should be status-driven:

```text
Draft | Waiting | Ready | Done | Canceled
```

For Adjustments, omit Waiting because it is not a valid adjustment state.

Kanban does not change mutation behavior and does not become the canonical source of status.

## 9. Receipt Detail

Components:

```text
PageHeader
OperationActionBar
StatusStepper
OperationMetaForm
LineItemsTable
```

Wireframe action order:

```text
Validate | Print | Cancel
```

Status stepper:

```text
Draft → Ready → Done
```

Fields:

- reference (read-only)
- Receive From
- Scheduled Date
- Responsible
- destination/location
- Products
- Quantity

## 10. Delivery Detail

Same structure as Receipt with:

```text
Draft → Waiting → Ready → Done
```

Fields:

- reference
- Delivery Address/contact
- Scheduled Date
- Responsible
- Operation Type (wireframe-visible)
- Source Location
- Products
- Quantity

The `Operation Type` field is rendered but its values/meaning must come from an agreed product contract; the frontend must not invent domain semantics.

### Shortage UI

When validation returns `WAITING` + shortages:

- affected line gets an error treatment
- show requested quantity
- show available Free to Use
- show a clear inline/banner message
- retain the operation in Waiting state

## 11. Stock Page

Table:

```text
Product | Per Unit Cost | On Hand | Free to Use | Update
```

Update action:

1. Open small Update Stock form.
2. Enter physical count.
3. Submit.
4. Service creates/validates a single-line Adjustment.
5. Refetch Stock and Move History.

The component never executes a raw stock update.

## 12. Move History Page

Default:

```text
Move History
Search | Filters | [List] [Kanban]

Reference | Date | Contact | From | To | Quantity | Status
```

Map immutable ledger data into a movement row:

```ts
type MoveHistoryRow = {
  reference: string;
  date: string;
  contact: string | null;
  from: string | null;
  to: string | null;
  quantity: number;
  status: OperationStatus;
  operationId: string;
  ledgerId: string;
};
```

Multiple products under one reference become multiple rows.

Positive/incoming quantity uses the positive movement style; negative/outgoing uses the negative movement style. Never rely on color alone.

## 13. Dashboard Page

Do not replace the wireframe's two-card operational layout with a generic KPI wall.

Components:

```text
Dashboard
ReceiptCard
DeliveryCard
StockEntryPoint
RecentOperations
```

Receipt card:

- To receive action/count
- late count
- open operation count

Delivery card:

- To deliver action/count
- late count
- waiting count
- open operation count

The exact displayed sample numbers in the image are fixture/demo values, not hardcoded UI values.

## 14. Forms

Use:

- react-hook-form
- Zod
- shared validators
- server error mapping

For operation lines, use `useFieldArray`.

Do not calculate:

- stock
- free-to-use
- late
- waiting
- ledger quantities

in the frontend.

## 15. Query/Mutation Strategy

TanStack Query owns server state.

Mutation success invalidates affected queries:

- operation detail/list
- Stock
- Dashboard
- Move History
- Products where stock visibility is shown

Example:

```ts
queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });
queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
queryClient.invalidateQueries({ queryKey: queryKeys.moveHistory.all });
```

## 16. Service Boundary

Components never call Supabase directly.

Allowed path:

```text
Page/Hook
  -> service function
  -> Supabase table read or RPC
  -> typed domain object
```

All state-changing inventory operations go through RPCs.

## 17. Loading/Error/Empty States

Every wireframed table/page has:

- loading skeleton
- inline/page error
- empty state
- mutation loading state

Stock shortage errors are displayed close to the affected product line, not only as a global toast.

## 18. Responsive Behavior

- Top navigation collapses into a menu on small screens.
- Tables scroll horizontally.
- Forms become one column.
- Operation action buttons wrap cleanly.
- List/Kanban toggle remains visible and keyboard accessible.

## 19. Developer Ownership

Developer B owns:

- `src/app`
- `src/components`
- `src/features`
- `src/hooks`
- `src/lib`

Developer A owns:

- SQL migrations
- RPCs
- RLS
- seed data

Shared contract:

- `06-api-contracts.md`
- generated `database.types.ts`

## 20. AI Coding Rules

- Search shared components before creating a new one.
- Do not introduce a sidebar contrary to the wireframe.
- Do not bypass services.
- Do not calculate inventory business rules in React.
- Do not invent semantics for the wireframe's unspecified Delivery `Operation Type`.
- Run `tsc --noEmit` and `npm run build` after substantial changes.
