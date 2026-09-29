// CSV helpers with protection against CSV/formula injection.
// Values starting with = + - @ (or tab/CR) are executed as formulas by Excel/Sheets,
// so they're prefixed with a single quote. Every value is quoted and inner quotes doubled.

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function escapeCsvValue(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");
}

// Triggers a browser download (UTF-8 BOM so Excel detects accents correctly)
export function downloadCsv(filename, csvContent) {
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function safeFilename(text) {
  return String(text || "export")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}
