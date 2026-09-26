export type AppErrorCode =
  | "CONFIGURATION_ERROR"
  | "VALIDATION_ERROR"
  | "DUPLICATE_SKU"
  | "DUPLICATE_SHORT_CODE"
  | "INSUFFICIENT_STOCK"
  | "INVALID_QUANTITY"
  | "INVALID_LOCATION"
  | "ALREADY_COMPLETED"
  | "ALREADY_CANCELED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "UNKNOWN_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly field?: string;
  readonly details?: string;

  constructor(code: AppErrorCode, message: string, options?: { field?: string; details?: string }) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.field = options?.field;
    this.details = options?.details;
  }
}

const knownCodes: AppErrorCode[] = [
  "VALIDATION_ERROR", "DUPLICATE_SKU", "DUPLICATE_SHORT_CODE", "INSUFFICIENT_STOCK",
  "INVALID_QUANTITY", "INVALID_LOCATION", "ALREADY_COMPLETED", "ALREADY_CANCELED",
  "UNAUTHORIZED", "NOT_FOUND",
];

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const raw = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const rawMessage = typeof raw.message === "string" ? raw.message : "";
  const hint = typeof raw.hint === "string" ? raw.hint : "";
  const details = typeof raw.details === "string" ? raw.details : undefined;
  const message = [rawMessage, hint].filter(Boolean).join(" ");
  const upper = `${rawMessage} ${hint}`.toUpperCase();
  const constraint = `${rawMessage} ${details ?? ""}`.toLowerCase();

  let code: AppErrorCode = "UNKNOWN_ERROR";
  if (constraint.includes("products_sku_key")) code = "DUPLICATE_SKU";
  else if (constraint.includes("short_code")) code = "DUPLICATE_SHORT_CODE";
  else if (knownCodes.some((known) => upper.includes(known))) {
    code = knownCodes.find((known) => upper.includes(known)) ?? "UNKNOWN_ERROR";
  } else if (upper.includes("INVALID LOGIN") || upper.includes("INVALID CREDENTIAL") || upper.includes("JWT")) {
    code = "UNAUTHORIZED";
  } else if (raw.code === "23505") {
    code = "VALIDATION_ERROR";
  }

  const friendly: Partial<Record<AppErrorCode, string>> = {
    CONFIGURATION_ERROR: "Supabase is not configured. Add the project URL and anon key to the local environment.",
    DUPLICATE_SKU: "That SKU is already in use.",
    DUPLICATE_SHORT_CODE: "That short code is already in use.",
    UNAUTHORIZED: "The email or password is incorrect, or your session has expired.",
    ALREADY_COMPLETED: "This operation is already complete.",
    ALREADY_CANCELED: "This operation has already been canceled.",
  };

  return new AppError(code, friendly[code] ?? (message || "Something went wrong. Please try again."), { details });
}
