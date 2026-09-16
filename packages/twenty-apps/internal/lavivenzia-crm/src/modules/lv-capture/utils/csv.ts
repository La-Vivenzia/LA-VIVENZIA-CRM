// A small RFC 4180 reader: quoted fields, doubled quotes, embedded newlines,
// CR/LF or LF line ends, comma / semicolon / tab delimiters (detected from
// the header line). Runs in the browser sandbox and on the server alike, so
// the mapping screen and the validation route see exactly the same rows.

export type CsvTable = { headers: string[]; rows: string[][]; delimiter: string; skippedEmptyRows: number };

export const detectDelimiter = (headerLine: string): string => {
  const counts = [',', ';', '\t', '|'].map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length - 1 }));

  return counts.sort((left, right) => right.count - left.count)[0]!.count > 0 ? counts.sort((left, right) => right.count - left.count)[0]!.delimiter : ',';
};

export const parseCsv = (text: string, options: { delimiter?: string; maxRows?: number } = {}): CsvTable => {
  const source = text.replace(/^﻿/, '');
  const firstLineEnd = source.search(/\r?\n/);
  const delimiter = options.delimiter ?? detectDelimiter(firstLineEnd === -1 ? source : source.slice(0, firstLineEnd));
  const maxRows = options.maxRows ?? 5_000;
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }

      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') {
        index += 1;
      }

      row.push(field);
      field = '';
      records.push(row);
      row = [];

      if (records.length > maxRows + 1) {
        break;
      }
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  const headers = (records.shift() ?? []).map((header) => header.trim());
  let skippedEmptyRows = 0;
  const rows = records
    .filter((cells) => {
      const empty = cells.every((cell) => cell.trim().length === 0);

      if (empty) {
        skippedEmptyRows += 1;
      }

      return !empty;
    })
    .slice(0, maxRows)
    .map((cells) => headers.map((_, column) => (cells[column] ?? '').trim()));

  return { headers, rows, delimiter, skippedEmptyRows };
};
