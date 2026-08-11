
"use client";

import { useCrm } from "@/lib/store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CircleCheck, Search, Download, FileSpreadsheet, Printer } from "lucide-react";
import { useState, useMemo } from "react";
import { inr, formatDate, statusColor, allFacings, downloadCSV, downloadXLS, printHTML, formatAcres, toAcres } from "@/lib/format";
import type { Plot, PlotStatus } from "@/lib/types";
import { Input } from "@/components/ui/input";
import PlotDetailsPanel from "@/components/panels/PlotDetailsPanel";

interface Props {
  status: PlotStatus | "all";
  permissions?: { canExport: boolean };
}

const statusMeta: Record<string, { title: string; description: string; icon: typeof CircleCheck; accent: string }> = {
  all: {
    title: "All Plots",
    description: "Complete plot inventory across all projects, layouts, and statuses.",
    icon: CircleCheck,
    accent: "text-primary",
  },
  available: {
    title: "Vacant Plots",
    description: "All plots currently available for booking and sale.",
    icon: CircleCheck,
    accent: "text-emerald-600",
  },
  reserved: {
    title: "Reserved Plots",
    description: "Plots held for buyers via bookings. Includes booking expiry tracking.",
    icon: CircleCheck,
    accent: "text-sky-600",
  },
  sold: {
    title: "Sold Plots",
    description: "Completed plot sales with registration details and outstanding balances.",
    icon: CircleCheck,
    accent: "text-rose-600",
  },
  booked: {
    title: "Booked Plots",
    description: "Plots with confirmed bookings pending registration.",
    icon: CircleCheck,
    accent: "text-amber-600",
  },
  blocked: {
    title: "Blocked Plots",
    description: "Plots temporarily blocked from sale.",
    icon: CircleCheck,
    accent: "text-slate-600",
  },
};

export default function PlotListPage({ status, permissions }: Props) {
  const { plots, projects, layouts, customers, bookings, sales, payments } = useCrm();

  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterLayout, setFilterLayout] = useState<string>("all");
  const [filterBlock, setFilterBlock] = useState<string>("all");
  const [filterFacing, setFilterFacing] = useState<string>("all");
  const [filterCorner, setFilterCorner] = useState<string>("all");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [sizeMin, setSizeMin] = useState<string>("");
  const [sizeMax, setSizeMax] = useState<string>("");
  const [roadWidth, setRoadWidth] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [exportFormat, setExportFormat] = useState<"card" | "block" | "table">("card");
  // Plot details open in-place (slide-over panel) — no navigation to Interactive Layout
  const [openPlotId, setOpenPlotId] = useState<string | undefined>(undefined);

  // Numeric plot number (handles "1", "10", "2A", "12B" → 1, 10, 2, 12)
  const plotSortNum = (p: Plot): number => {
    const m = String(p.plotNumber).match(/\d+/);
    return m ? parseInt(m[0], 10) : Number.MAX_SAFE_INTEGER;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plots
      .filter((p) => status === "all" || p.status === status)
      .filter((p) => filterProject === "all" || p.projectId === filterProject)
      .filter((p) => filterLayout === "all" || p.layoutId === filterLayout)
      .filter((p) => filterBlock === "all" || p.block === filterBlock)
      .filter((p) => filterFacing === "all" || p.facing === filterFacing)
      .filter((p) => filterCorner === "all" || (filterCorner === "yes" ? p.cornerPlot : !p.cornerPlot))
      .filter((p) => !priceMin || p.totalPrice >= parseFloat(priceMin))
      .filter((p) => !priceMax || p.totalPrice <= parseFloat(priceMax))
      .filter((p) => !sizeMin || p.size >= parseFloat(sizeMin))
      .filter((p) => !sizeMax || p.size <= parseFloat(sizeMax))
      .filter((p) => !roadWidth || p.roadWidth >= parseFloat(roadWidth))
      .filter((p) => {
        if (!q) return true;
        const proj = projects.find((x) => x.id === p.projectId)?.name ?? "";
        const layout = layouts.find((l) => l.id === p.layoutId)?.name ?? "";
        return (
          p.plotNumber.toLowerCase().includes(q) ||
          p.block.toLowerCase().includes(q) ||
          proj.toLowerCase().includes(q) ||
          layout.toLowerCase().includes(q)
        );
      })
      // Always show plots in order: project → block → plot number (numeric).
      // Without this, plots regenerated on project-edit save jump to the end of the list.
      .sort((a, b) => {
        const projA = projects.find((x) => x.id === a.projectId)?.name ?? "";
        const projB = projects.find((x) => x.id === b.projectId)?.name ?? "";
        if (projA !== projB) return projA.localeCompare(projB);
        const blockA = a.block ?? "";
        const blockB = b.block ?? "";
        if (blockA !== blockB) return blockA.localeCompare(blockB, undefined, { numeric: true });
        return plotSortNum(a) - plotSortNum(b);
      });
  }, [plots, status, filterProject, filterLayout, filterBlock, filterFacing, filterCorner, priceMin, priceMax, sizeMin, sizeMax, roadWidth, query, projects, layouts]);

  // Also add a status filter dropdown for the "All Plots" page so users can narrow down
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const filteredWithStatus = useMemo(() => {
    if (status !== "all" || filterStatus === "all") return filtered;
    return filtered.filter((p) => p.status === filterStatus);
  }, [filtered, status, filterStatus]);

  const blocks = Array.from(new Set(plots.map((p) => p.block).filter(Boolean)));
  const layoutsForProject = filterProject === "all" ? layouts : layouts.filter((l) => l.projectId === filterProject);
  const meta = statusMeta[status] ?? statusMeta.all;

  const openPlot = (p: Plot) => {
    // Open plot details in-place (slide-over panel) — no navigation away from the list
    setOpenPlotId(p.id);
  };

  const clearFilters = () => {
    setFilterProject("all");
    setFilterLayout("all");
    setFilterBlock("all");
    setFilterFacing("all");
    setFilterCorner("all");
    setPriceMin("");
    setPriceMax("");
    setSizeMin("");
    setSizeMax("");
    setRoadWidth("");
  };

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title={meta.title}
        description={meta.description}
        actions={
          <Badge variant="outline" className="text-sm px-3 py-1.5">
            {filteredWithStatus.length} plot{filteredWithStatus.length !== 1 ? "s" : ""}
          </Badge>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Plots</div>
          <div className={`text-xl font-bold mt-1 ${meta.accent}`}>{filteredWithStatus.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Area</div>
          <div className="text-xl font-bold mt-1">
            {filteredWithStatus.length > 0
              ? `${filteredWithStatus.reduce((s, p) => s + toAcres(p.size, p.sizeUnit), 0).toFixed(3)} Acres`
              : "0 Acres"}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Value</div>
          <div className="text-xl font-bold mt-1">{inr(filteredWithStatus.reduce((s, p) => s + p.totalPrice, 0))}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg Price</div>
          <div className="text-xl font-bold mt-1">
            {inr(filteredWithStatus.length > 0 ? filteredWithStatus.reduce((s, p) => s + p.totalPrice, 0) / filteredWithStatus.length : 0)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Avg Size {filterProject === "all" && <span className="text-[9px]">(Acres)</span>}
          </div>
          <div className="text-xl font-bold mt-1">
            {(() => {
              if (filteredWithStatus.length === 0) return "0";
              // Avg Size: when a specific project is selected → use that project's unit (cents or sqyd)
              // When "All Projects" is selected → use Acres (projects may use different units)
              if (filterProject === "all") {
                return `${(filteredWithStatus.reduce((s, p) => s + toAcres(p.size, p.sizeUnit), 0) / filteredWithStatus.length).toFixed(3)} Acres`;
              }
              const unit = filteredWithStatus[0]?.sizeUnit ?? "cents";
              const avg = filteredWithStatus.reduce((s, p) => s + p.size, 0) / filteredWithStatus.length;
              return `${avg.toFixed(2)} ${unit === "sqyd" ? "sq yd" : "cents"}`;
            })()}
          </div>
        </Card>
      </div>

      {/* Filter toolbar */}
      <Card className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by plot #, block, project..."
              className="pl-8 h-9 w-56 text-sm"
            />
          </div>
          {status === "all" && (
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={filterProject} onValueChange={(v) => { setFilterProject(v); setFilterLayout("all"); }}>
            <SelectTrigger className="h-9 w-44 text-xs">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterLayout} onValueChange={setFilterLayout}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue placeholder="Layout" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Layouts</SelectItem>
              {layoutsForProject.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterBlock} onValueChange={setFilterBlock}>
            <SelectTrigger className="h-9 w-28 text-xs">
              <SelectValue placeholder="Block" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Blocks</SelectItem>
              {blocks.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterFacing} onValueChange={setFilterFacing}>
            <SelectTrigger className="h-9 w-32 text-xs">
              <SelectValue placeholder="Facing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Facing</SelectItem>
              {allFacings.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCorner} onValueChange={setFilterCorner}>
            <SelectTrigger className="h-9 w-28 text-xs">
              <SelectValue placeholder="Corner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="yes">Corner</SelectItem>
              <SelectItem value="no">Not Corner</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Min ₹"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="h-9 w-24 text-xs"
          />
          <Input
            type="number"
            placeholder="Max ₹"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="h-9 w-24 text-xs"
          />
          <Input
            type="number"
            placeholder="Min sqft"
            value={sizeMin}
            onChange={(e) => setSizeMin(e.target.value)}
            className="h-9 w-24 text-xs"
          />
          <Input
            type="number"
            placeholder="Max sqft"
            value={sizeMax}
            onChange={(e) => setSizeMax(e.target.value)}
            className="h-9 w-24 text-xs"
          />
          <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
            Clear
          </Button>
          {permissions?.canExport !== false && (
          <div className="ml-auto flex items-center gap-1">
            {/* Export format toggle — Card (on-screen form), Block (grouped by block), Table (list) */}
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "card" | "block" | "table")}>
              <SelectTrigger className="h-9 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="block">Block</SelectItem>
                <SelectItem value="table">Table List</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9" onClick={() => downloadCSV(`vgg-${status}-plots.csv`, filteredWithStatus.map((p) => ({
              "Plot": p.plotNumber, "Project": projects.find((x) => x.id === p.projectId)?.name ?? "",
              "Layout": layouts.find((l) => l.id === p.layoutId)?.name ?? "", "Block": p.block,
              "Size": `${p.size} ${p.sizeUnit}`, "Area (Acres)": toAcres(p.size, p.sizeUnit).toFixed(4),
              "Facing": p.facing, "Corner": p.cornerPlot ? "Yes" : "No",
              "Price": p.pricePerCent, "Total Price": p.totalPrice, "Status": statusColor[p.status].label,
            })))}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => downloadXLS(`vgg-${status}-plots.xls`, filteredWithStatus.map((p) => ({
              "Plot": p.plotNumber, "Project": projects.find((x) => x.id === p.projectId)?.name ?? "",
              "Layout": layouts.find((l) => l.id === p.layoutId)?.name ?? "", "Block": p.block,
              "Size": `${p.size} ${p.sizeUnit}`, "Area (Acres)": toAcres(p.size, p.sizeUnit).toFixed(4),
              "Facing": p.facing, "Corner": p.cornerPlot ? "Yes" : "No",
              "Price": p.pricePerCent, "Total Price": p.totalPrice, "Status": statusColor[p.status].label,
            })))}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel
            </Button>
            {/* PDF export — Card / Block / Table based on toggle */}
            <Button variant="default" size="sm" className="h-9 bg-primary" onClick={() => {
              const proj = filterProject !== "all" ? projects.find((p) => p.id === filterProject)?.name : "All Projects";
              const totalAcres = filteredWithStatus.reduce((s, p) => s + toAcres(p.size, p.sizeUnit), 0).toFixed(3);
              const headerMeta = `Project: ${proj} · ${filteredWithStatus.length} plots · ${totalAcres} Acres · ${new Date().toLocaleDateString("en-IN")}`;

              if (exportFormat === "table") {
                // Table format — full detail per plot, one row per plot
                const rows = filteredWithStatus.map((p) => {
                  const sc = statusColor[p.status];
                  const projName = projects.find((x) => x.id === p.projectId)?.name ?? "";
                  return `<tr>
                    <td style="padding:4px 8px;border:1px solid #e2e8f0;font-weight:bold">${p.plotNumber}</td>
                    <td style="padding:4px 8px;border:1px solid #e2e8f0">${projName}</td>
                    <td style="padding:4px 8px;border:1px solid #e2e8f0">${p.block}</td>
                    <td style="padding:4px 8px;border:1px solid #e2e8f0">${p.size} ${p.sizeUnit === "sqyd" ? "sq yd" : "cents"}</td>
                    <td style="padding:4px 8px;border:1px solid #e2e8f0">${toAcres(p.size, p.sizeUnit).toFixed(3)}</td>
                    <td style="padding:4px 8px;border:1px solid #e2e8f0">${p.facing}</td>
                    <td style="padding:4px 8px;border:1px solid #e2e8f0">${p.cornerPlot ? "Yes" : "No"}</td>
                    <td style="padding:4px 8px;border:1px solid #e2e8f0">₹${p.totalPrice.toLocaleString("en-IN")}</td>
                    <td style="padding:4px 8px;border:1px solid #e2e8f0;color:${sc.hex};font-weight:600">${sc.label}</td>
                  </tr>`;
                }).join("");
                printHTML(`${meta.title} — Table`, `<h2>${meta.title}</h2><div style="color:#64748b;margin-bottom:12px;font-size:11px">${headerMeta}</div><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;border:1px solid #e2e8f0">Plot</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Project</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Block</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Size</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Acres</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Facing</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Corner</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Total Price</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Status</th></tr></thead><tbody>${rows}</tbody></table>`);
              } else if (exportFormat === "block") {
                // Block format — grouped by block, plot numbers listed per block
                const blockNames = Array.from(new Set(filteredWithStatus.map((p) => p.block))).sort();
                const blockRows = blockNames.map((blockName) => {
                  const blockPlots = filteredWithStatus.filter((p) => p.block === blockName);
                  const blockAcres = blockPlots.reduce((s, p) => s + toAcres(p.size, p.sizeUnit), 0).toFixed(3);
                  return `<tr><td style="font-weight:bold;padding:6px 10px;border:1px solid #e2e8f0;font-size:14px">${blockName}</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${blockPlots.length}</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${blockAcres} Acres</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${blockPlots.map((p) => p.plotNumber).join(", ")}</td></tr>`;
                }).join("");
                printHTML(`${meta.title} — Block Summary`, `<h2>${meta.title}</h2><div style="color:#64748b;margin-bottom:12px;font-size:11px">${headerMeta}</div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f1f5f9"><th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left">Block</th><th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left">Count</th><th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left">Total Area</th><th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left">Plot Numbers</th></tr></thead><tbody>${blockRows}</tbody></table>`);
              } else {
                // Card format — matches the on-screen plot cards (detailed visual cards)
                const cards = filteredWithStatus.map((p) => {
                  const sc = statusColor[p.status];
                  const projName = projects.find((x) => x.id === p.projectId)?.name ?? "";
                  const layoutName = layouts.find((l) => l.id === p.layoutId)?.name ?? "";
                  return `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:4px;display:inline-block;width:200px;vertical-align:top;font-size:10px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
                    <div style="background:${sc.hex};color:#fff;padding:8px 10px;">
                      <div style="font-weight:bold;font-size:16px">${p.plotNumber} ${p.cornerPlot ? '<span style="font-size:8px;background:rgba(255,255,255,0.3);padding:1px 4px;border-radius:3px;float:right">CORNER</span>' : ""}</div>
                      <div style="font-size:9px;opacity:0.9">${sc.label}</div>
                    </div>
                    <div style="padding:8px 10px;">
                      <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="background:#f1f5f9;padding:1px 6px;border-radius:3px;font-size:9px;">Block ${p.block}</span><span style="color:#64748b">${p.facing}</span></div>
                      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px;"><span style="color:#64748b">Size:</span><span style="font-weight:600">${p.size} ${p.sizeUnit === "sqyd" ? "sq yd" : "cents"}</span></div>
                      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px;"><span style="color:#64748b">Area:</span><span style="font-weight:600">${toAcres(p.size, p.sizeUnit).toFixed(3)} Acres</span></div>
                      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px;"><span style="color:#64748b">Road:</span><span style="font-weight:600">${p.roadWidth} ft</span></div>
                      <div style="border-top:1px solid #e2e8f0;margin-top:4px;padding-top:4px;">
                        <div style="color:#64748b;font-size:8px;text-transform:uppercase">Total Price</div>
                        <div style="font-weight:bold;font-size:14px;color:#0f766e">₹${p.totalPrice.toLocaleString("en-IN")}</div>
                        <div style="color:#64748b;font-size:8px">₹${p.pricePerCent.toLocaleString("en-IN")}/${p.sizeUnit === "sqyd" ? "sqyd" : "cent"}</div>
                      </div>
                      <div style="border-top:1px solid #e2e8f0;margin-top:4px;padding-top:4px;color:#64748b;font-size:8px">${projName} · ${layoutName}</div>
                    </div>
                  </div>`;
                }).join("");
                printHTML(`${meta.title} — Cards`, `<h2>${meta.title}</h2><div style="color:#64748b;margin-bottom:12px;font-size:11px">${headerMeta}</div><div>${cards}</div>`);
              }
            }}>
              <Printer className="w-3.5 h-3.5 mr-1.5" /> PDF
            </Button>
          </div>
          )}
        </div>
      </Card>

      {/* Plot boxes grid */}
      {filteredWithStatus.length === 0 ? (
        <Card className="p-12 text-center">
          <meta.icon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <div className="font-semibold">No plots match your filters</div>
          <div className="text-sm text-muted-foreground mt-1">Try adjusting or clearing the filters above.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredWithStatus.map((p) => {
            const sc = statusColor[p.status];
            const proj = projects.find((x) => x.id === p.projectId);
            const layout = layouts.find((l) => l.id === p.layoutId);
            const cust = customers.find((c) => c.id === p.customerId);
            const b = bookings.find((b) => b.id === p.bookingId);
            const s = sales.find((s) => s.id === p.saleId);
            return (
              <button
                key={p.id}
                onClick={() => openPlot(p)}
                className="plot-card text-left bg-card rounded-xl border border-border overflow-hidden group fade-in"
              >
                {/* Status color stripe + plot number */}
                <div
                  className="px-3 py-2.5 text-white relative"
                  style={{ background: sc.hex }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold">{p.plotNumber}</div>
                    {p.cornerPlot && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/25 backdrop-blur font-semibold uppercase">
                        Corner
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] opacity-90 mt-0.5">{sc.label}</div>
                </div>

                {/* Body */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <Badge variant="outline" className="text-[10px]">Block {p.block}</Badge>
                    <span className="text-muted-foreground">{p.facing}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Size</div>
                      <div className="font-semibold">{p.size} <span className="text-[10px] font-normal text-muted-foreground">{p.sizeUnit}</span></div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Road</div>
                      <div className="font-semibold">{p.roadWidth}<span className="text-[10px] font-normal text-muted-foreground"> ft</span></div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <div className="text-[10px] text-muted-foreground uppercase">Total Price</div>
                    <div className="font-bold text-base text-primary">{inr(p.totalPrice)}</div>
                    <div className="text-[10px] text-muted-foreground">{inr(p.pricePerCent)}/{p.sizeUnit === "sqyd" ? "sqyd" : "cent"}</div>
                  </div>

                  {/* Status-specific info (show on all-plots page + status pages) */}
                  {(p.status === "reserved" || p.status === "booked") && cust && (
                    <div className="pt-2 border-t border-border text-[11px]">
                      <div className="font-medium truncate">{cust.name}</div>
                      <div className="text-muted-foreground">Adv: {inr(b?.advancePaid ?? 0)}</div>
                      {b?.discount && b.discount > 0 && (
                        <div className="text-rose-600">Disc: {inr(b.discount)}</div>
                      )}
                      {b?.bookingExpiry && (
                        <div className="text-muted-foreground">Exp: {formatDate(b.bookingExpiry)}</div>
                      )}
                    </div>
                  )}
                  {p.status === "sold" && cust && (
                    <div className="pt-2 border-t border-border text-[11px]">
                      <div className="font-medium truncate">{cust.name}</div>
                      {s && (
                        <>
                          <div className="text-muted-foreground font-mono">{s.registrationNumber}</div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-muted-foreground">{formatDate(s.saleDate)}</span>
                            <span className={`font-semibold ${(s.balanceAmount ?? 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              Bal: {inr(s.balanceAmount ?? 0)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Project footer */}
                  <div className="pt-2 border-t border-border text-[10px] text-muted-foreground truncate">
                    {proj?.name} · {layout?.name}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Plot details slide-over panel — opens in-place, no page navigation */}
      <PlotDetailsPanel plotId={openPlotId} onClose={() => setOpenPlotId(undefined)} />
    </div>
  );
}


