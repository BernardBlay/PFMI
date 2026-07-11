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
    <div className={`overflow-x-auto rounded-xl border border-border-mute bg-surface ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead className="bg-background/80 text-text-muted border-b border-border-mute">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-4 py-3 text-[9px] font-mono font-bold uppercase tracking-widest ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-mute">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-text-muted text-xs font-mono"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-background/40 transition-colors duration-150"
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 text-xs text-foreground ${col.className ?? ""}`}
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
