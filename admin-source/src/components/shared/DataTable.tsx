
"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  FileText,
  Printer,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { downloadCSV, downloadXLS, printHTML } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  title?: string;
  description?: string;
  toolbar?: ReactNode; // additional filter chips, etc.
  columns: DataTableColumn<T>[];
  rows: T[];
  searchKeys?: (keyof T | ((row: T) => string))[];
  searchPlaceholder?: string;
  pageSize?: number;
  exportFilename?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rightToolbar?: ReactNode;
  permissions?: { canExport: boolean };
}

export function DataTable<T extends { id: string }>({
  title,
  description,
  toolbar,
  columns,
  rows,
  searchKeys,
  searchPlaceholder = "Search...",
  pageSize = 10,
  exportFilename = "export",
  emptyMessage = "No records found.",
  onRowClick,
  rightToolbar,
  permissions,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    let result = rows;
    if (query && searchKeys) {
      const q = query.toLowerCase();
      result = result.filter((row) =>
        searchKeys.some((k) =>
          (typeof k === "function" ? k(row) : String(row[k] ?? "")).toLowerCase().includes(q),
        ),
      );
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortValue) {
        result = [...result].sort((a, b) => {
          const va = col.sortValue!(a);
          const vb = col.sortValue!(b);
          if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
          return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
        });
      }
    }
    return result;
  }, [rows, query, searchKeys, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const [selectedExportCols, setSelectedExportCols] = useState<Set<string>>(new Set(columns.map((c) => c.key)));
  const [showColSelect, setShowColSelect] = useState(false);

  const buildExportRows = () =>
    filtered.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.filter((c) => selectedExportCols.has(c.key)).forEach((c) => {
        const v = c.sortValue ? c.sortValue(row) : (row as Record<string, unknown>)[c.key];
        obj[c.header] = v;
      });
      return obj;
    });

  const toggleExportCol = (key: string) => {
    setSelectedExportCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {(title || description || searchKeys) && (
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div>
            {title && <div className="font-semibold text-base">{title}</div>}
            {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {searchKeys && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder={searchPlaceholder}
                  className="pl-8 h-9 w-56 text-sm"
                />
              </div>
            )}
            {rightToolbar}
            {permissions?.canExport !== false && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[10px] uppercase">Export Format</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => downloadCSV(`${exportFilename}.csv`, buildExportRows())}>
                  <Download className="w-3.5 h-3.5 mr-2" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadXLS(`${exportFilename}.xls`, buildExportRows())}>
                  <FileText className="w-3.5 h-3.5 mr-2" /> Excel (.xls)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const activeCols = columns.filter((c) => selectedExportCols.has(c.key));
                    const headers = activeCols.map((c) => c.header);
                    const rowsHtml = filtered
                      .map(
                        (row) =>
                          "<tr>" +
                          activeCols
                            .map((c) => {
                              const v = c.sortValue ? c.sortValue(row) : (row as Record<string, unknown>)[c.key];
                              return `<td>${v == null ? "" : String(v).replace(/</g, "&lt;")}</td>`;
                            })
                            .join("") +
                          "</tr>",
                      )
                      .join("");
                    printHTML(
                      title || exportFilename,
                      `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rowsHtml}</tbody></table>`,
                    );
                  }}
                >
                  <Printer className="w-3.5 h-3.5 mr-2" /> Print / PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase">Select Columns to Export</DropdownMenuLabel>
                <div className="max-h-48 overflow-y-auto">
                  {columns.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-muted/50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedExportCols.has(c.key)}
                        onChange={() => toggleExportCol(c.key)}
                        className="w-3.5 h-3.5 accent-primary"
                      />
                      <span>{c.header}</span>
                    </label>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedExportCols(new Set(columns.map((c) => c.key)))}>
                  <span className="text-[10px] text-primary">Select All</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedExportCols(new Set())}>
                  <span className="text-[10px] text-muted-foreground">Deselect All</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {toolbar && <div className="p-3 bg-muted/20 border-b border-border flex flex-wrap gap-2">{toolbar}</div>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="premium-table-header hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={c.className}
                >
                  {c.sortable ? (
                    <button
                      onClick={() => handleSort(c.key)}
                      className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      {c.header}
                      {sortKey === c.key ? (
                        sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground text-sm fade-in">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-muted/40 grid place-items-center">
                      <Search className="w-5 h-5 text-muted-foreground/40" />
                    </div>
                    {emptyMessage}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={`premium-table-row fade-in stagger-${Math.min(idx + 1, 6)} ${onRowClick ? "cursor-pointer" : ""}`}
                >
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Showing <span className="font-medium text-foreground">{pageRows.length}</span> of{" "}
          <span className="font-medium text-foreground">{filtered.length}</span> records
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="px-2">
            Page {safePage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export { PageHeader };


