import type { MovementType, OperationStatus, OperationType, UserRole } from "./database.types";

export type Profile = {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
};

export type LocationSummary = {
  id: string;
  name: string;
  shortCode: string;
  warehouseId: string;
  warehouseName: string;
  warehouseShortCode?: string;
};

export type OperationLine = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  lineNumber: number;
  freeToUseAtSource?: number | null;
  difference?: number | null;
};

export type OperationSummary = {
  id: string;
  type: OperationType;
  reference: string;
  status: OperationStatus;
  scheduledDate: string;
  isLate: boolean;
  responsibleUser: { id: string; displayName: string } | null;
  sourceLocation: LocationSummary | null;
  destinationLocation: LocationSummary | null;
  partnerName: string | null;
};

export type OperationDetail = OperationSummary & {
  reason: string | null;
  lines: OperationLine[];
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
  canceledAt: string | null;
  createdBy?: string | null;
};

export type Shortage = {
  productId: string;
  productName: string;
  sku: string;
  requested: number;
  available: number;
};

export type ValidationResult =
  | { operation: OperationDetail; shortages: [] }
  | { operation: OperationDetail & { status: "WAITING" }; shortages: Shortage[] };

export type Product = {
  id: string;
  name: string;
  sku: string;
  categoryId: string | null;
  categoryName?: string | null;
  unitOfMeasure: string;
  reorderLevel: number;
  unitCost: number | null;
  isActive: boolean;
  onHand?: number;
  stockByLocation?: { locationId: string; locationName: string; onHand: number }[];
};

export type StockItem = {
  productId: string;
  productName: string;
  sku: string;
  locationId: string;
  locationName: string;
  warehouseId: string;
  warehouseName: string;
  categoryId: string | null;
  categoryName: string | null;
  unitCost: number | null;
  onHand: number;
  freeToUse: number;
};

export type MoveHistoryRow = {
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
};
