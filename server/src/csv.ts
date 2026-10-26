export type Cell = string | number | boolean | null | undefined;

const NUMERIC = /^-?\d+(\.\d+)?$/;

function cell(v: Cell): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  // Stop spreadsheet apps from running text as a formula (free-text answers are participant input).
  if (/^[=+\-@\t\r]/.test(s) && !NUMERIC.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: string[], rows: Record<string, Cell>[]): string {
  const lines = [columns.map(cell).join(',')];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c])).join(','));
  return lines.join('\r\n') + '\r\n';
}
