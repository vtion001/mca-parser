// Core CSV formatting utilities — reusable across any CSV export

/**
 * Escape a CSV field value — wrap in quotes if contains comma, quote, or newline.
 * Also escape existing quotes by doubling them (RFC 4180 compliant).
 */
export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert an array of objects to CSV string.
 */
export function toCsv<T extends Record<string, string | number | null | undefined>>(
  data: T[],
  columns: (keyof T)[]
): string {
  const header = columns.map(col => escapeCsvField(String(col))).join(',');
  const rows = data.map(row =>
    columns.map(col => escapeCsvField(row[col])).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Trigger a browser download of CSV content.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
