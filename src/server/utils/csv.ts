const escapeCsvCell = (value: string): string => {
  const escaped = value.replace(/"/g, "\"\"");
  return `"${escaped}"`;
};

export const buildCsv = (headers: string[], rows: string[][]): string => {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(","));
  return [headerLine, ...dataLines].join("\n");
};
