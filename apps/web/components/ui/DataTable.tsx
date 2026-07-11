import { ReactNode } from "react";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface Props<T extends { id: string | number }> {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  className?: string;
}

export default function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  emptyMessage = "No records found.",
  className = "",
}: Props<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead className="bg-surface-container-low text-on-surface-variant border-b border-outline-variant">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-4 py-3 text-label-md font-label uppercase tracking-wider ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-on-surface-variant text-body-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-surface-container-low/50 transition-colors duration-150"
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 text-body-sm text-on-surface ${col.className ?? ""}`}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as any)[col.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
