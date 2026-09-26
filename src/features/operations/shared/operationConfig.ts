import type { OperationStatus, OperationType } from "@/types/database.types";

export type OperationConfig = {
  segment: "receipts" | "deliveries";
  type: OperationType;
  title: string;
  singular: string;
  partnerLabel: string;
  locationLabel: string;
  locationMode: "source" | "destination";
  statusFlow: OperationStatus[];
  supportsWaiting: boolean;
  supportsPrint: boolean;
  showReason: boolean;
  showDeliveryOperationType: boolean;
};

export const operationConfigs: Record<"receipts" | "deliveries", OperationConfig> = {
  receipts: {
    segment: "receipts",
    type: "RECEIPT",
    title: "Receipts",
    singular: "Receipt",
    partnerLabel: "Receive From",
    locationLabel: "Destination Location",
    locationMode: "destination",
    statusFlow: ["DRAFT", "READY", "DONE"],
    supportsWaiting: false,
    supportsPrint: true,
    showReason: false,
    showDeliveryOperationType: false,
  },
  deliveries: {
    segment: "deliveries",
    type: "DELIVERY",
    title: "Deliveries",
    singular: "Delivery",
    partnerLabel: "Delivery Address",
    locationLabel: "Source Location",
    locationMode: "source",
    statusFlow: ["DRAFT", "WAITING", "READY", "DONE"],
    supportsWaiting: true,
    supportsPrint: true,
    showReason: false,
    showDeliveryOperationType: true,
  },
};
