# StockSense — API / Service Contracts (Wireframe-Aligned)

> This contract preserves the PRD's business rules and adds the read shapes required by the wireframe. Frontend services must return domain objects, not raw Supabase responses.

## 1. Shared Error Shape

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Human-readable message",
  "field": null
}
```

Codes:

```text
VALIDATION_ERROR
DUPLICATE_SKU
DUPLICATE_SHORT_CODE
INSUFFICIENT_STOCK
INVALID_QUANTITY
INVALID_LOCATION
ALREADY_COMPLETED
ALREADY_CANCELED
UNAUTHORIZED
NOT_FOUND
```

## 2. Auth

### `authService.signUp({ email, password, displayName })`

Response:

```ts
{ user: { id: string; email: string }; session: Session | null }
```

The wireframe's Login Id/Email Id labels do not introduce a separate username identity.

### `authService.signIn({ email, password })`

Invalid credentials map to `UNAUTHORIZED`.

### `authService.signOut()`

Returns:

```ts
{ success: true }
```

### `authService.resetPasswordForEmail({ email })`

Always returns generic success.

### `authService.updatePassword({ newPassword })`

Updates password from the reset session.

### `authService.getProfile()`

```ts
{
  id: string;
  displayName: string;
  email: string;
  role: 'manager' | 'staff';
}
```

### `authService.updateProfile({ displayName })`

Updates display name only.

## 3. Products

### `productService.listProducts(filters)`

Filters:

```ts
{
  search?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}
```

Response:

```ts
{
  items: Product[];
  total: number;
}
```

`Product` includes company-wide `onHand`.

### `productService.getProduct(id)`

Includes:

```ts
stockByLocation: {
  locationId: string;
  locationName: string;
  onHand: number;
}[]
```

### `productService.createProduct(input)`

Supports optional:

```ts
initialStock?: {
  locationId: string;
  quantity: number;
}
```

Initial stock must produce a normal auditable Adjustment-style ledger entry.

### `productService.updateProduct(id, input)`

SKU uniqueness is server-validated.

## 4. Warehouses

### `warehouseService.listWarehouses()`

```ts
{
  id: string;
  name: string;
  shortCode: string;
  address: string | null;
  locationCount: number;
}[]
```

### `warehouseService.getWarehouse(id)`

Includes child locations.

### `warehouseService.createWarehouse(input)`

Input:

```ts
{
  name: string;
  shortCode: string;
  address?: string;
}
```

### `warehouseService.updateWarehouse(id, input)`

Same uniqueness/validation rules.

## 5. Locations

### `locationService.listLocations({ warehouseId? })`

Returns:

```ts
{
  id: string;
  name: string;
  shortCode: string;
  warehouseId: string;
  warehouseName: string;
}[]
```

### `locationService.getLocation(id)`

Includes current stock rows.

### `locationService.createLocation(input)`

```ts
{
  name: string;
  shortCode: string;
  warehouseId: string;
}
```

### `locationService.updateLocation(id, input)`

Validates uniqueness within the target warehouse.

## 6. Stock

### `stockService.listStock(filters)`

Filters:

```ts
{
  search?: string;
  warehouseId?: string;
  locationId?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
}
```

Response:

```ts
{
  items: {
    productId: string;
    productName: string;
    sku: string;
    locationId: string;
    locationName: string;
    warehouseName: string;
    unitCost: number | null;
    onHand: number;
    freeToUse: number;
  }[];
  total: number;
}
```

### `stockService.updateStockFromCount(input)`

Wireframe-specific action.

Request:

```ts
{
  productId: string;
  locationId: string;
  physicalCount: number;
  reason?: string;
}
```

Response:

```ts
{
  operation: OperationDetail;
  stock: {
    productId: string;
    locationId: string;
    onHand: number;
    freeToUse: number;
  };
}
```

Implementation calls a controlled backend Adjustment flow; it never updates `stock_balances` directly.

## 7. Dashboard

### `dashboardService.getSummary(filters?)`

Return the wireframe's operational summary:

```ts
{
  receipts: {
    openCount: number;
    lateCount: number;
    waitingCount: number;
  };
  deliveries: {
    openCount: number;
    lateCount: number;
    waitingCount: number;
  };
}
```

The broader PRD KPI values may also be returned, but the primary visual presentation is the Receipt and Delivery cards.

### `dashboardService.listRecentOperations(filters?)`

Returns recent operations with enough data to navigate to their details.

## 8. Shared Operation Summary

```ts
type OperationSummary = {
  id: string;
  type: OperationType;
  reference: string;
  status: OperationStatus;
  scheduledDate: string;
  isLate: boolean;
  responsibleUser: {
    id: string;
    displayName: string;
  } | null;
  sourceLocation: LocationSummary | null;
  destinationLocation: LocationSummary | null;
  partnerName: string | null;
};
```

## 9. Shared Operation Detail

```ts
type OperationDetail = OperationSummary & {
  reason: string | null;
  lines: {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    freeToUseAtSource: number | null;
    difference: number | null;
  }[];
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
  canceledAt: string | null;
};
```

## 10. Receipt Services

### `receiptService.listReceipts(filters)`

Filters:

```ts
{
  status?: OperationStatus;
  warehouseId?: string;
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string; // reference or contact
}
```

Response:

```ts
{ items: OperationSummary[]; total: number }
```

### `receiptService.getReceipt(id)`

Returns `OperationDetail`.

### `receiptService.createReceipt(input)`

```ts
{
  partnerName: string;
  scheduledDate: string;
  responsibleUserId?: string;
  destinationLocationId: string;
  lines: { productId: string; quantity: number }[];
}
```

Reference:

```text
{WarehouseShortCode}/IN/{ID}
```

### `receiptService.updateReceipt(id, input)`

Only `DRAFT`.

### `receiptService.markReady(id)`

`DRAFT -> READY`.

### `receiptService.validateReceipt(id)`

`READY -> DONE`, increases destination stock.

### `receiptService.cancelReceipt(id)`

`DRAFT/READY -> CANCELED`.

## 11. Delivery Services

### `deliveryService.listDeliveries(filters)`

Same list filters as Receipts.

### `deliveryService.getDelivery(id)`

Returns `OperationDetail`.

### `deliveryService.createDelivery(input)`

```ts
{
  partnerName: string;
  scheduledDate: string;
  responsibleUserId?: string;
  sourceLocationId: string;
  lines: { productId: string; quantity: number }[];
  operationTypeValue?: string | null;
}
```

`operationTypeValue` is optional/opaque until the wireframe's Operation Type meaning is specified. It must not be mapped to the global `operation_type` enum.

Reference:

```text
{WarehouseShortCode}/OUT/{ID}
```

### `deliveryService.updateDelivery(id, input)`

Only `DRAFT`.

### `deliveryService.markReady(id)`

`DRAFT -> READY`.

### `deliveryService.validateDelivery(id)`

Success:

```ts
{ operation: OperationDetail }
```

Shortage:

```ts
{
  operation: OperationDetail & { status: 'WAITING' };
  shortages: {
    productId: string;
    productName: string;
    requested: number;
    available: number;
  }[];
}
```

Shortage is a normal business result, not a generic server error.

### `deliveryService.cancelDelivery(id)`

`DRAFT/WAITING/READY -> CANCELED`.

## 12. Transfer Services

Same shared operation contract.

Create input:

```ts
{
  scheduledDate: string;
  responsibleUserId?: string;
  sourceLocationId: string;
  destinationLocationId: string;
  lines: { productId: string; quantity: number }[];
}
```

Validation:

- source != destination
- sufficient Free to Use
- shortage -> `WAITING`
- success -> `DONE`

Reference:

```text
{SourceWarehouseShortCode}/TRF/{ID}
```

## 13. Adjustment Services

Create:

```ts
{
  scheduledDate: string;
  responsibleUserId?: string;
  destinationLocationId: string;
  reason?: string;
  lines: {
    productId: string;
    quantity: number; // physical count
  }[];
}
```

Validation:

```text
physical count - current on hand = ledger quantity_change
```

No Waiting state.

## 14. Move History

### `ledgerService.listMoveHistory(filters)`

Filters:

```ts
{
  search?: string;       // reference or contact
  productId?: string;
  locationId?: string;
  movementType?: MovementType;
  status?: OperationStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}
```

Response:

```ts
{
  items: {
    ledgerId: string;
    operationId: string;
    reference: string;
    date: string;
    contact: string | null;
    from: string | null;
    to: string | null;
    productId: string;
    productName: string;
    quantity: number;
    status: OperationStatus;
    movementType: MovementType;
  }[];
  total: number;
}
```

The service reads the backend `move_history` view. It does not mutate the ledger.

## 15. Printing

Print does not need a mutation API.

The UI requests the operation detail and uses a print stylesheet.

## 16. Query Invalidation

After Receipt/Delivery/Transfer/Adjustment validation or Stock Update:

- invalidate operation list/detail
- invalidate Stock
- invalidate Dashboard
- invalidate Move History
- invalidate Product stock totals where shown

## 17. Error Mapping

Map Supabase/Postgres errors centrally:

```text
duplicate SKU -> DUPLICATE_SKU
duplicate warehouse code -> DUPLICATE_SHORT_CODE
duplicate location code -> DUPLICATE_SHORT_CODE
insufficient stock -> WAITING + shortages
done operation -> ALREADY_COMPLETED
canceled operation -> ALREADY_CANCELED
missing/invalid field -> VALIDATION_ERROR
```
