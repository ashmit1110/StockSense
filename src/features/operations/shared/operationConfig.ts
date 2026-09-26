import type { OperationStatus, OperationType } from "@/types/database.types";

export type OperationConfig = {
  segment: "receipts" | "deliveries" | "transfers" | "adjustments";
  type: OperationType;
  title: string;
  singular: string;
  partnerLabel: string;
  locationLabel: string;
  locationMode: "source" | "destination" | "both";
  sourceLocationLabel?: string;
  destinationLocationLabel?: string;
  statusFlow: OperationStatus[];
  supportsWaiting: boolean;
  supportsPrint: boolean;
  showReason: boolean;
  showPartner: boolean;
  showDeliveryOperationType: boolean;
};

export const operationConfigs: Record<"receipts" | "deliveries" | "transfers" | "adjustments", OperationConfig> = {
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
    showPartner: true,
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
    showPartner: true,
    showDeliveryOperationType: true,
  },
  transfers: {
    segment: "transfers",
    type: "TRANSFER",
    title: "Transfers",
    singular: "Transfer",
    partnerLabel: "Contact",
    locationLabel: "Location",
    locationMode: "both",
    sourceLocationLabel: "Source Location",
    destinationLocationLabel: "Destination Location",
    statusFlow: ["DRAFT", "WAITING", "READY", "DONE"],
    supportsWaiting: true,
    supportsPrint: false,
    showReason: false,
    showPartner: false,
    showDeliveryOperationType: false,
  },
  adjustments: {
    segment: "adjustments",
    type: "ADJUSTMENT",
    title: "Adjustments",
    singular: "Adjustment",
    partnerLabel: "Contact",
    locationLabel: "Location",
    locationMode: "destination",
    statusFlow: ["DRAFT", "READY", "DONE"],
    supportsWaiting: false,
    supportsPrint: false,
    showReason: true,
    showPartner: false,
    showDeliveryOperationType: false,
  },
};
