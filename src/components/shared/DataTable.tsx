import type { ReactNode } from "react";

export type Column<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string };

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  rowLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead className="bg-white/[.035] text-xs uppercase tracking-wide text-muted">
          <tr>{columns.map((column) => <th className={`px-4 py-3 font-medium ${column.className ?? ""}`} key={column.key} scope="col">{column.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line/80">
          {rows.map((row) => (
            <tr
              className={onRowClick ? "cursor-pointer transition hover:bg-white/[.035] focus-within:bg-white/[.035]" : "transition hover:bg-white/[.025]"}
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onRowClick(row); } } : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
            >
              {columns.map((column) => <td className={`px-4 py-3.5 align-middle ${column.className ?? ""}`} key={column.key}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
