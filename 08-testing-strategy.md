# StockSense — Testing Strategy (Wireframe-Aligned)

## 1. Testing Priority

For the six-hour build, prioritize:

1. stock correctness
2. operation lifecycle
3. wireframe-critical interactions
4. auth/navigation
5. visual polish

## 2. Critical Inventory Tests

Must pass:

1. Receipt validation increases destination stock exactly once.
2. Delivery with sufficient Free to Use decreases source stock exactly once.
3. Delivery shortage moves to Waiting and changes no stock.
4. Transfer decreases source and increases destination atomically.
5. Adjustment sets stock to physical count and records signed difference.
6. Stock Update action creates the same auditable Adjustment result.
7. Stock never becomes negative.
8. Done/Cancelled operations cannot be validated again.
9. Ledger is immutable.
10. Dashboard counts agree with canonical rules.

## 3. Wireframe Acceptance Tests

### Authentication

- [ ] Login screen contains Login Id and Password.
- [ ] Signup screen contains Login Id, Email Id, Password, Re-enter Password.
- [ ] Valid login lands on Dashboard.
- [ ] Forgot Password is reachable from Login.
- [ ] Logout returns to Login.

### Dashboard

- [ ] Dashboard shows Receipt card.
- [ ] Dashboard shows Delivery card.
- [ ] Receipt card exposes receive action/count.
- [ ] Delivery card exposes deliver action/count.
- [ ] Late counts follow the canonical rule.
- [ ] Waiting count appears for Delivery.
- [ ] Stock can be opened from the dashboard flow.
- [ ] Recent operation/history entry point works.

### Stock

- [ ] Table columns are Product, Per Unit Cost, On Hand, Free to Use.
- [ ] Free to Use reflects READY outgoing reservations.
- [ ] Update Stock action is visible.
- [ ] Updating a row changes stock through Adjustment logic.
- [ ] Update Stock creates a ledger entry.
- [ ] No direct client update of `stock_balances` exists.

### Warehouse

- [ ] Name field present.
- [ ] Short Code field present.
- [ ] Address field present.
- [ ] Duplicate Short Code is rejected.

### Location

- [ ] Name field present.
- [ ] Short Code field present.
- [ ] Warehouse selector present.
- [ ] Duplicate code within a warehouse is rejected.

### Receipt List

- [ ] List View is default.
- [ ] List/Kanban toggle is present.
- [ ] Search supports reference/contact.
- [ ] Status/date/location filters work.
- [ ] Clicking a row opens detail.
- [ ] New action opens creation flow.

### Receipt Detail

- [ ] New/Receipt heading pattern matches wireframe.
- [ ] Validate button exists.
- [ ] Print button exists.
- [ ] Cancel button exists.
- [ ] Status progression shows Draft → Ready → Done.
- [ ] Receive From is visible.
- [ ] Schedule Date is visible.
- [ ] Responsible is visible.
- [ ] Product + Quantity lines are visible.
- [ ] New Product/Add Product action exists.
- [ ] Done receipt is read-only.

### Delivery List

- [ ] List View is default.
- [ ] List/Kanban toggle is present.
- [ ] Search supports reference/contact.
- [ ] Filters work.
- [ ] New action works.

### Delivery Detail

- [ ] Validate/Print/Cancel are visible.
- [ ] Status progression shows Draft → Waiting → Ready → Done.
- [ ] Delivery Address is visible.
- [ ] Schedule Date is visible.
- [ ] Responsible is visible.
- [ ] Operation Type control is rendered as in the wireframe.
- [ ] Product + Quantity lines are visible.
- [ ] Insufficient stock marks the affected line.
- [ ] Shortage message identifies requested vs available.
- [ ] Successful validation decreases stock.

### Move History

- [ ] Opening page lands in List View.
- [ ] Table has Reference, Date, Contact, From, To, Quantity, Status.
- [ ] Search supports reference/contact.
- [ ] One reference with multiple products renders multiple rows.
- [ ] Incoming movement uses positive/green presentation.
- [ ] Outgoing movement uses negative/red presentation.
- [ ] Clicking a reference opens its source operation where applicable.
- [ ] Underlying ledger remains immutable.

## 4. Database Tests

Run in Supabase SQL editor:

```sql
-- negative stock blocked
update stock_balances
set on_hand = -1
where id = '<test-balance-id>';
```

Expected: constraint failure.

Ledger mutation:

```sql
update stock_ledger
set quantity_change = 1
where id = '<test-ledger-id>';
```

Expected: immutable-ledger trigger/RLS rejection.

Also verify:

- duplicate SKU rejected
- duplicate warehouse code rejected
- duplicate warehouse+location code rejected

## 5. Concurrency Tests

Scenario:

```text
stock = 10

Delivery A = 8
Delivery B = 8
```

Run validations concurrently.

Expected:

- stock never negative
- no partial ledger application
- operation status remains correct
- only valid stock-consuming mutation succeeds

## 6. Operation Integration Tests

### Receipt

```text
Before: 100
Receipt: +50
After: 150
Ledger: +50 RECEIPT
```

### Delivery

```text
Before: 100
Delivery: 20
After: 80
Ledger: -20 DELIVERY
```

### Delivery shortage

```text
Available: 5
Requested: 10
Status: WAITING
Stock: 5
Ledger: unchanged
```

### Transfer

```text
A: 100 -> 50
B: 20 -> 70
Ledger: -50 TRANSFER_OUT +50 TRANSFER_IN
Company total unchanged
```

### Adjustment

```text
System: 50
Physical: 47
After: 47
Ledger: -3 ADJUSTMENT
```

### Stock Update

```text
Stock row: 50
Update to: 47
After: 47
Ledger: -3 ADJUSTMENT
```

## 7. Manual Demo Run

1. Login.
2. Dashboard.
3. Open Stock.
4. Create/validate Receipt.
5. Verify stock increase.
6. Create/validate Delivery.
7. Trigger shortage and verify Waiting + red line.
8. Use Stock Update.
9. Validate Transfer.
10. Validate Adjustment.
11. Open Move History.
12. Search by reference/contact.
13. Verify multiple products produce multiple rows.
14. Verify positive/negative movement display.

## 8. Regression Checklist

After any change to `validate_operation`, `update_stock_from_count`, or Move History:

- [ ] Receipt
- [ ] Delivery
- [ ] Delivery shortage
- [ ] Transfer
- [ ] Adjustment
- [ ] Stock Update
- [ ] Negative-stock guard
- [ ] Double validation
- [ ] Cancellation
- [ ] Ledger immutability
- [ ] Dashboard counts
- [ ] Move History row mapping
- [ ] Search/filter behavior
- [ ] List/Kanban toggle
