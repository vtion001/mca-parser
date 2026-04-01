interface DataTableProps<T> {
  columns: { key: keyof T; label: string; align?: 'left' | 'right' | 'center'; width?: string; render?: (v: T[keyof T], row: T) => React.ReactNode }[];
  data: T[];
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, emptyMessage = 'No data' }: DataTableProps<T>) {
  if (data.length === 0) {
    return <div className="py-6 text-center text-bw-400 text-xs">{emptyMessage}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-bw-50">
            {columns.map(col => (
              <th
                key={String(col.key)}
                className={`px-3 py-2 text-[9px] font-semibold text-bw-500 uppercase tracking-wider ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                }`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-bw-100 hover:bg-bw-50 transition-colors">
              {columns.map(col => (
                <td
                  key={String(col.key)}
                  className={`px-3 py-2.5 text-bw-700 ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
