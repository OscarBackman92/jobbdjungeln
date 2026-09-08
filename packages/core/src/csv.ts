/**
 * CSV export.
 *
 * Semicolon-delimited with a UTF-8 BOM, because that is what Excel in a Swedish
 * locale opens correctly without an import dialog.
 */

/**
 * Neutralise spreadsheet formula injection.
 *
 * A cell starting with `=`, `+`, `-`, `@`, tab or CR is executed as a formula by
 * Excel and Google Sheets. Since cells here contain user- and employer-supplied
 * text, prefix those with an apostrophe so they are read as text.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value == null) return '';
  const text = String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function quote(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const CSV_DELIMITER = ';';
const BOM = '\uFEFF';

export function toCsv(
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [columns.map(quote).join(CSV_DELIMITER)];
  for (const row of rows) {
    lines.push(row.map((cell) => quote(sanitizeCsvCell(cell))).join(CSV_DELIMITER));
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

/** A `Content-Disposition` value that survives non-ASCII filenames. */
export function contentDisposition(filename: string): string {
  const ascii = [...filename]
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      const unsafe = code < 0x20 || code > 0x7e || char === '"' || char === '\\';
      return unsafe ? '_' : char;
    })
    .join('');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
