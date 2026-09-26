export function formatQuantity(value: number, unit?: string) {
  const quantity = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
  return unit ? `${quantity} ${unit}` : quantity;
}

export function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}

export function formatDate(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

export function formatDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}
