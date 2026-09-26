# StockSense — Design Document (Wireframe-Aligned UX/UI Specification)

> `01-prd.md` is intentionally unchanged. The supplied `arch.png` governs the screen structure, visible labels, controls, and interaction patterns described here.

## 1. Wireframe Map

The image explicitly depicts:

1. Login / Signup
2. Dashboard
3. Stock
4. Warehouse
5. Location
6. Move History
7. Receipt list
8. Receipt detail
9. Delivery list
10. Delivery detail

Products, Transfers, and Adjustments are required by the PRD but have no dedicated wireframes; they reuse these patterns.

## 2. Global Shell

The desktop navigation shown repeatedly in the image is:

```text
Dashboard   Operations   Products   Move History   Settings
```

Settings contains Warehouses and Locations. Operations contains Receipts, Deliveries, Transfers, and Adjustments.

Use a compact **top navigation/header**, not a permanent left sidebar.

Authenticated page structure:

```text
Top navigation
Page title / primary action
Search + filters + view controls
Main bordered table/card/form
```

The supplied wireframe uses a dark canvas with red/pink outlines. Implementation should preserve the restrained panel/table composition while using project theme tokens.

## 3. Routes

```text
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

## 4. Login / Signup

### Login

```text
Login Page
┌──────────────────────┐
│ Login Id             │
│ Password             │
│ [ Log In ]           │
│ Forgot Password?     │
└──────────────────────┘
```

The unchanged PRD maps Login Id to the email identity.

### Signup

```text
Sign Up Page
┌──────────────────────┐
│ Login Id             │
│ Email Id             │
│ Enter Password       │
│ Re-enter Password    │
│ [ Sign Up ]          │
└──────────────────────┘
```

Do not introduce a separate username identity merely to reproduce the wireframe labels.

## 5. Dashboard

Primary composition is two large operational cards:

```text
┌──────────────────────────┐   ┌──────────────────────────┐
│ Receipt                  │   │ Delivery                 │
│ [ To receive ]           │   │ [ To deliver ]           │
│ Late                     │   │ Late                     │
│ Operations               │   │ Waiting                  │
└──────────────────────────┘   │ Operations               │
                               └──────────────────────────┘
```

The numbers in the drawing are example values, not hardcoded UI.

Also preserve the wireframe annotations:

- clear path to list available stock
- recent/history of operations
- Late = past scheduled date while non-final
- Waiting = waiting for required stock

Do not replace this with a generic four-card KPI wall.

## 6. Stock

Wireframe table:

| Product | Per Unit Cost | On Hand | Free to Use |
|---|---:|---:|---:|
| product | cost | qty | qty |

The page must provide an **Update Stock** action from the row. It invokes the Adjustment workflow rather than directly editing stock.

## 7. Warehouse

Fields exactly matching the wireframe:

- Name
- Short Code
- Address

Save/create and edit use the common form shell.

## 8. Location

Fields:

- Name
- Short Code
- Warehouse

Warehouse is a required parent selector.

## 9. Operation Lists

Receipts and Deliveries are explicitly drawn; Transfers and Adjustments reuse the same shell.

Default:

**List View**

Controls:

```text
[ New ] [ Search ] [ List ] [ Kanban ]
```

Search:

- reference
- contact

Filters:

- status
- warehouse/location
- scheduled date

Clicking a row opens detail.

## 10. Receipt List

Recommended wireframe-equivalent shape:

```text
[New] Receipts                   [Search] [List] [Kanban]

Reference | Date | Contact | From | To | Quantity | Status
```

## 11. Receipt Detail

```text
[New] Receipt
[Validate] [Print] [Cancel]        [Draft → Ready → Done]

Reference
Receive From                    Schedule Date
Responsible

Products
Product                         Quantity
...
New Product
```

Rules:

- Draft = initial/editable stage.
- Ready = ready to receive.
- Done = received/read-only.
- Print is meaningful after Done.
- Validate/Cancel are confirmed actions.
- Reference is `{WarehouseShortCode}/IN/{ID}`.

## 12. Delivery List

Same shell:

```text
[New] Delivery                   [Search] [List] [Kanban]

Reference | Date | Contact | From | To | Quantity | Status
```

## 13. Delivery Detail

```text
[New] Delivery
[Validate] [Print] [Cancel]       [Draft → Waiting → Ready → Done]

Reference
Delivery Address                 Schedule Date
Responsible                      Operation Type

Products
Product                          Quantity
...
New Product
```

Shortage behavior:

- affected product line gets an error treatment
- an alert explains that the product is not sufficiently in stock
- operation becomes/remains Waiting

The `Operation Type` control is visibly part of the wireframe. Its exact domain values are not specified by the source material and must not be invented.

## 14. Move History

The image explicitly says:

> By default land on List View.

Table:

| Reference | Date | Contact | From | To | Quantity | Status |
|---|---|---|---|---|---:|---|

Wireframe-specific behavior:

- search by reference/contact
- populate movement rows using From/To location context
- one reference with multiple products appears in multiple rows
- incoming movement is positive/green
- outgoing movement is negative/red
- List View is the default
- List/Kanban control is visible

The backend source remains the immutable stock ledger; the UI view joins ledger data with operation metadata.

## 15. Products

No dedicated image. Reuse the same:

- top navigation
- compact table
- New action
- search/filter row
- detail form

## 16. Transfers

Reuse Delivery structure:

- source
- destination
- date
- responsible
- product/quantity
- Draft → Waiting → Ready → Done
- Validate / Cancel
- shortage line treatment

## 17. Adjustments

Reuse Receipt structure:

- location
- date
- responsible
- reason
- product/physical count
- Draft → Ready → Done
- Validate / Cancel

## 18. Feedback

Use:

- inline field errors
- visible stock-shortage alerts
- success/error toasts
- skeleton rows
- empty states
- confirmation dialogs for irreversible mutations

## 19. Accessibility

- all inputs have labels
- status/quantity colors are paired with text
- keyboard accessible controls
- focus-trapped dialogs
- error text linked to fields

## 20. Responsive Behavior

- top nav collapses into a menu on small screens
- tables can scroll horizontally
- forms become one column
- action buttons wrap without clipping
- List/Kanban toggle remains accessible
