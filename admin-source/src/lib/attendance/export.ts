/**
 * Export helpers — CSV + XLSX-friendly SpreadsheetML.
 *
 * We avoid the heavy `xlsx` npm dependency and produce:
 *   - CSV  (RFC 4180, UTF-8 with BOM for Excel)
 *   - XLSX via the SpreadsheetML 2003 XML format (.xls) which Excel
 *     opens natively. This is lightweight and dependency-free.
 */

type Row = Record<string, string | number | null | undefined>;

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: Row[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => escapeCsv(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escapeCsv(r[c.key])).join(","))
    .join("\r\n");
  // BOM for Excel UTF-8 detection.
  return "\uFEFF" + header + "\r\n" + body;
}

/**
 * SpreadsheetML 2003 — opens in Excel as a real spreadsheet with
 * columns / rows. File extension `.xls`.
 */
export function toSpreadsheetXml(
  rows: Row[],
  columns: { key: string; label: string }[],
  sheetName = "Attendance",
): string {
  const esc = (s: unknown) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const headerRow = `<Row>${columns
    .map(
      (c) =>
        `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${esc(c.label)}</Data></Cell>`,
    )
    .join("")}</Row>`;
  const dataRows = rows
    .map((r) => {
      const cells = columns
        .map((c) => {
          const v = r[c.key];
          const isNum = typeof v === "number" && Number.isFinite(v);
          return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${esc(v ?? "")}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="sHeader">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${esc(sheetName)}">
  <Table>
   ${headerRow}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;
}
