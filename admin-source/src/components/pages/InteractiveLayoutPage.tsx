
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
import {
  ZoomIn,
  ZoomOut,
  MousePointerClick,
  Grid3x3,
  Plus,
  Minus,
  Eye,
  EyeOff,
  Maximize2,
  LayoutGrid,
  Map as MapIcon,
  FileBarChart,
  Image as ImageIcon,
  Printer,
} from "lucide-react";
import { useMemo, useState } from "react";
import { statusColor, inr, printHTML, toAcres } from "@/lib/format";
import PlotDetailsPanel from "@/components/panels/PlotDetailsPanel";
import type { Plot, PlotStatus, RouteKey } from "@/lib/types";
import type { Permissions } from "@/lib/permissions";

interface InteractiveLayoutPageProps {
  selectedProjectId?: string;
  selectedLayoutId?: string;
  selectedPlotId?: string;
  onNavigate?: (route: RouteKey, ctx?: { selectedProjectId?: string; selectedLayoutId?: string; selectedPlotId?: string }) => void;
  permissions?: Permissions;
}

export default function InteractiveLayoutPage({ selectedProjectId, selectedLayoutId, selectedPlotId, onNavigate, permissions }: InteractiveLayoutPageProps) {
  const {
    projects,
    layouts,
    plots,
    setPlotStatus,
  } = useCrm();

  const [activeProjectId, setActiveProjectId] = useState<string>(
    selectedProjectId || projects[0]?.id || "",
  );
  const [activeLayoutId, setActiveLayoutId] = useState<string>(
    selectedLayoutId || layouts.find((l) => l.projectId === activeProjectId)?.id || "",
  );
  const [openPlotId, setOpenPlotId] = useState<string | undefined>(selectedPlotId);
  const [zoom, setZoom] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [filterStatus, setFilterStatus] = useState<PlotStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"map" | "block">("block");
  const [sortBy, setSortBy] = useState<string>("plotNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  // Multi-status filter for export section
  const [exportStatuses, setExportStatuses] = useState<Set<PlotStatus>>(new Set(["available", "booked", "reserved", "sold", "blocked"]));
  const [exportFormat, setExportFormat] = useState<"card" | "block" | "table">("card");

  const project = projects.find((p) => p.id === activeProjectId);
  const layout = layouts.find((l) => l.id === activeLayoutId);
  const layoutPlots = useMemo(
    () => plots.filter((p) => p.layoutId === activeLayoutId),
    [plots, activeLayoutId],
  );

  const filteredPlots = useMemo(() => {
    if (filterStatus === "all") return layoutPlots;
    return layoutPlots.filter((p) => p.status === filterStatus);
  }, [layoutPlots, filterStatus]);

  // Status counts for legend
  const statusCounts = useMemo(() => {
    const counts: Record<PlotStatus, number> = {
      available: 0,
      reserved: 0,
      sold: 0,
      booked: 0,
      blocked: 0,
    };
    layoutPlots.forEach((p) => counts[p.status]++);
    return counts;
  }, [layoutPlots]);

  // Plots grouped by block (for Block View)
  const blockGroups = useMemo(() => {
    const map: Record<string, Plot[]> = {};
    filteredPlots.forEach((p) => {
      (map[p.block] ||= []).push(p);
    });
    // Sort plots within each block by plot number (numeric part)
    Object.values(map).forEach((arr) => {
      arr.sort((a, b) => {
        const na = parseInt(a.plotNumber.replace(/[^\d]/g, ""), 10) || 0;
        const nb = parseInt(b.plotNumber.replace(/[^\d]/g, ""), 10) || 0;
        return na - nb;
      });
    });
    // Return sorted by block name
    return Object.keys(map)
      .sort()
      .map((block) => ({ block, plots: map[block] }));
  }, [filteredPlots]);

  const handlePlotClick = (plot: Plot) => {
    setOpenPlotId(plot.id);
  };

  // Sorted plots for the export section
  const sortedPlots = useMemo(() => {
    const sorted = [...filteredPlots];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "plotNumber":
          cmp = parseInt(a.plotNumber, 10) - parseInt(b.plotNumber, 10);
          break;
        case "block":
          cmp = a.block.localeCompare(b.block) || parseInt(a.plotNumber, 10) - parseInt(b.plotNumber, 10);
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "price":
          cmp = a.totalPrice - b.totalPrice;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "facing":
          cmp = a.facing.localeCompare(b.facing);
          break;
        default:
          cmp = 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredPlots, sortBy, sortDir]);

  // Export-filtered plots (uses multi-status filter)
  const exportFilteredPlots = useMemo(() => {
    return sortedPlots.filter((p) => exportStatuses.has(p.status));
  }, [sortedPlots, exportStatuses]);

  const toggleExportStatus = (s: PlotStatus) => {
    setExportStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  // Build HTML for export (boxes or list table format)
  const buildExportHTML = (format: "card" | "block" | "table") => {
    const plots = exportFilteredPlots;
    const proj = project?.name ?? "All Projects";
    const statusLabel = exportStatuses.size === 5 ? "All" : Array.from(exportStatuses).map((s) => statusColor[s].label).join(", ");
    const totalAcres = plots.reduce((s, p) => s + toAcres(p.size, p.sizeUnit), 0).toFixed(3);
    const header = `<div style="font-size:16px;font-weight:bold;margin-bottom:4px">${proj} · ${plots.length} plots (${statusLabel})</div>
      <div style="color:#64748b;margin-bottom:12px;font-size:11px">Total Area: ${totalAcres} Acres · Sorted by ${sortBy} (${sortDir}) · ${new Date().toLocaleDateString("en-IN")}</div>`;

    if (format === "table") {
      // Table format — full detail per plot, one row per plot
      const rows = plots.map((p) => {
        const sc = statusColor[p.status];
        return `<tr>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;font-weight:bold">${p.plotNumber}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0">${p.block}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0">${p.size} ${p.sizeUnit === "sqyd" ? "sq yd" : "cents"}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0">${toAcres(p.size, p.sizeUnit).toFixed(3)}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0">${p.facing}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0">${p.cornerPlot ? "Yes" : "No"}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0">₹${p.totalPrice.toLocaleString("en-IN")}</td>
          <td style="padding:4px 8px;border:1px solid #e2e8f0;color:${sc.hex};font-weight:600">${sc.label}</td>
        </tr>`;
      }).join("");
      return header + `<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#f1f5f9"><th style="padding:6px 8px;border:1px solid #e2e8f0">Plot</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Block</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Size</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Acres</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Facing</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Corner</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Total Price</th><th style="padding:6px 8px;border:1px solid #e2e8f0">Status</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    if (format === "block") {
      // Block format — grouped by block, plot numbers + area per block
      const blocks = Array.from(new Set(plots.map((p) => p.block))).sort();
      const rows = blocks.map((blockName) => {
        const blockPlots = plots.filter((p) => p.block === blockName).sort((a, b) => parseInt(a.plotNumber) - parseInt(b.plotNumber));
        const blockAcres = blockPlots.reduce((s, p) => s + toAcres(p.size, p.sizeUnit), 0).toFixed(3);
        return `<tr><td style="font-weight:bold;padding:6px 10px;border:1px solid #e2e8f0;font-size:14px">${blockName}</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${blockPlots.length}</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${blockAcres} Acres</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${blockPlots.map((p) => p.plotNumber).join(", ")}</td></tr>`;
      }).join("");
      return header + `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f1f5f9"><th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left">Block</th><th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left">Count</th><th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left">Total Area</th><th style="padding:6px 10px;border:1px solid #e2e8f0;text-align:left">Plot Numbers</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    // Card format — detailed visual cards (matches on-screen plot cards)
    const cards = plots.map((plot) => {
      const sc = statusColor[plot.status];
      return `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:4px;display:inline-block;width:200px;vertical-align:top;font-size:10px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="background:${sc.hex};color:#fff;padding:8px 10px;">
          <div style="font-weight:bold;font-size:16px">${plot.plotNumber} ${plot.cornerPlot ? '<span style="font-size:8px;background:rgba(255,255,255,0.3);padding:1px 4px;border-radius:3px;float:right">CORNER</span>' : ""}</div>
          <div style="font-size:9px;opacity:0.9">${sc.label}</div>
        </div>
        <div style="padding:8px 10px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="background:#f1f5f9;padding:1px 6px;border-radius:3px;font-size:9px;">Block ${plot.block}</span><span style="color:#64748b">${plot.facing}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px;"><span style="color:#64748b">Size:</span><span style="font-weight:600">${plot.size} ${plot.sizeUnit === "sqyd" ? "sq yd" : "cents"}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px;"><span style="color:#64748b">Area:</span><span style="font-weight:600">${toAcres(plot.size, plot.sizeUnit).toFixed(3)} Acres</span></div>
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px;"><span style="color:#64748b">Road:</span><span style="font-weight:600">${plot.roadWidth} ft</span></div>
          <div style="border-top:1px solid #e2e8f0;margin-top:4px;padding-top:4px;">
            <div style="color:#64748b;font-size:8px;text-transform:uppercase">Total Price</div>
            <div style="font-weight:bold;font-size:14px;color:#0f766e">₹${plot.totalPrice.toLocaleString("en-IN")}</div>
            <div style="color:#64748b;font-size:8px">₹${plot.pricePerCent.toLocaleString("en-IN")}/${plot.sizeUnit === "sqyd" ? "sqyd" : "cent"}</div>
          </div>
        </div>
      </div>`;
    }).join("");
    return header + `<div>${cards}</div>`;
  };

  // Export plot boxes/list as printable PDF
  const exportPlotBoxesPDF = () => {
    const proj = project?.name ?? "All Projects";
    printHTML(`Plot Export — ${proj}`, buildExportHTML(exportFormat));
  };

  // Export plot boxes/list as JPG image
  const exportPlotBoxesJPG = () => {
    const html = buildExportHTML(exportFormat);
    const hiddenDiv = document.createElement("div");
    hiddenDiv.style.cssText = "position:fixed;left:-9999px;top:0;width:1200px;background:#fff;padding:20px;";
    hiddenDiv.innerHTML = html;
    document.body.appendChild(hiddenDiv);

    const width = 1200;
    const height = hiddenDiv.scrollHeight + 40;
    const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;background:#fff;padding:20px;">
          ${html}
        </div>
      </foreignObject>
    </svg>`;
    const svgBlob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const dlUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = dlUrl;
            a.download = `plot-export-${project?.name ?? "plots"}-${new Date().toISOString().slice(0, 10)}.jpg`;
            a.click();
            URL.revokeObjectURL(dlUrl);
          }
        }, "image/jpeg", 0.9);
      }
      URL.revokeObjectURL(url);
      document.body.removeChild(hiddenDiv);
    };
    img.onerror = () => {
      window.open(url);
      document.body.removeChild(hiddenDiv);
    };
    img.src = url;
  };

  // Schematic layout generator (only used if no image uploaded)
  // Renders a clean architectural-style grid as SVG
  const renderSchematic = () => {
    const blocks = Array.from(new Set(layoutPlots.map((p) => p.block)));
    const blockCols = blocks.length > 2 ? 2 : blocks.length;
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0">
          {/* Roads */}
          <rect x="0" y="48" width="100" height="4" fill="#fbbf24" opacity="0.3" />
          <rect x="48" y="0" width="4" height="100" fill="#fbbf24" opacity="0.3" />
          {/* Compound wall */}
          <rect x="2" y="2" width="96" height="96" fill="none" stroke="#0f766e" strokeWidth="0.5" strokeDasharray="2,1" />
          {/* Central green space */}
          <circle cx="50" cy="50" r="3" fill="#10b981" opacity="0.2" />
        </svg>
        {/* Block labels */}
        {blocks.map((b, i) => {
          const col = i % blockCols;
          const row = Math.floor(i / blockCols);
          const x = col === 0 ? 5 : 55;
          const y = row === 0 ? 5 : 55;
          return (
            <div
              key={b}
              className="absolute text-[10px] font-bold uppercase tracking-widest text-slate-400"
              style={{ left: `${x}%`, top: `${y - 3}%` }}
            >
              Block {b}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="view-enter space-y-4">
      <PageHeader
        title="Interactive Layout"
        description="Click any plot to view details, change status, or record bookings/sales/payments. Overlays adapt to any uploaded master layout image."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={activeProjectId} onValueChange={(v) => {
              setActiveProjectId(v);
              const first = layouts.find((l) => l.projectId === v);
              if (first) setActiveLayoutId(first.id);
            }}>
              <SelectTrigger className="h-9 w-48 text-xs">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeLayoutId} onValueChange={setActiveLayoutId}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <SelectValue placeholder="Layout" />
              </SelectTrigger>
              <SelectContent>
                {layouts.filter((l) => l.projectId === activeProjectId).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              <Grid3x3 className="w-3 h-3 mr-1" />
              {layoutPlots.length} plots
            </Badge>
            {(["available", "reserved", "booked", "sold", "blocked"] as PlotStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border transition ${
                  filterStatus === s
                    ? `${statusColor[s].bg} ${statusColor[s].text} border-transparent`
                    : "bg-card border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusColor[s].dot}`} />
                {statusColor[s].label}
                <span className="opacity-60">{statusCounts[s]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {/* View mode toggle */}
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("block")}
                className={`px-2.5 py-1.5 text-[11px] font-medium inline-flex items-center gap-1 transition ${
                  viewMode === "block"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Block View
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`px-2.5 py-1.5 text-[11px] font-medium inline-flex items-center gap-1 transition border-l border-border ${
                  viewMode === "map"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" /> Map View
              </button>
            </div>
            {viewMode === "map" && (
              <>
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}>
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <div className="px-2 text-xs font-medium w-14 text-center">{Math.round(zoom * 100)}%</div>
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}>
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setZoom(1)}>
                  <Maximize2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setShowLabels((v) => !v)}
                  title={showLabels ? "Hide labels" : "Show labels"}
                >
                  {showLabels ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Layout canvas */}
      <Card className="overflow-hidden">
        <div className="bg-muted/30 px-4 py-2 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MousePointerClick className="w-4 h-4 text-primary" />
            <div className="text-sm font-semibold">{project?.name} · {layout?.name}</div>
          </div>
          <div className="text-[11px] text-muted-foreground hidden md:block">
            {layout?.description}
          </div>
        </div>

        {viewMode === "map" ? (
          /* MAP VIEW — overlay on layout image */
          <div
            className="relative w-full overflow-auto"
            style={{ minHeight: "600px", maxHeight: "75vh" }}
          >
            <div
              className="relative mx-auto"
              style={{
                width: `min(${100 * zoom}%, ${1400 * zoom}px)`,
                aspectRatio: "16 / 10",
                minWidth: "600px",
              }}
            >
              {/* Layout image OR schematic */}
              {layout?.image ? (
                <img
                  src={layout.image}
                  alt={layout.name}
                  className="absolute inset-0 w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                renderSchematic()
              )}

              {/* Plot overlays */}
              {filteredPlots.map((plot) => {
                const sc = statusColor[plot.status];
                const isSelected = openPlotId === plot.id;
                const dim = filterStatus !== "all" && filterStatus !== plot.status ? 0.25 : 1;
                return (
                  <button
                    key={plot.id}
                    onClick={() => handlePlotClick(plot)}
                    className={`plot-overlay ${isSelected ? "selected" : ""}`}
                    style={{
                      left: `${plot.x}%`,
                      top: `${plot.y}%`,
                      width: `${plot.width}%`,
                      height: `${plot.height}%`,
                      background: sc.hex,
                      opacity: dim,
                    }}
                    title={`${plot.plotNumber} · ${sc.label} · ${plot.size} ${plot.sizeUnit} · ${inr(plot.totalPrice)}`}
                  >
                    {showLabels && (
                      <span className="text-[8px] sm:text-[9px] leading-none">
                        {plot.plotNumber}
                      </span>
                    )}
                  </button>
                );
              })}

              {layoutPlots.length === 0 && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center max-w-sm">
                    <Grid3x3 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                    <div className="font-semibold text-sm">No plots in this layout yet</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Plots will appear here automatically. Use the layout manager to upload a master layout image.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* BLOCK VIEW — separate boxes per block with plot tiles inside */
          <div className="p-4 max-h-[75vh] overflow-y-auto">
            {layoutPlots.length === 0 ? (
              <div className="text-center py-16">
                <Grid3x3 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <div className="font-semibold text-sm">No plots in this layout yet</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Plots are auto-generated when you create a project with block configuration.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {blockGroups.map((group) => {
                  const blockPlots = group.plots;
                  const blockAvailable = blockPlots.filter((p) => p.status === "available").length;
                  const blockSold = blockPlots.filter((p) => p.status === "sold").length;
                  const blockReserved = blockPlots.filter((p) => p.status === "reserved" || p.status === "booked").length;
                  const blockBlocked = blockPlots.filter((p) => p.status === "blocked").length;
                  return (
                    <div
                      key={group.block}
                      className="rounded-xl border-2 border-border bg-card overflow-hidden"
                    >
                      {/* Block header */}
                      <div className="px-4 py-3 bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold text-base shadow-md">
                            {group.block}
                          </div>
                          <div>
                            <div className="font-bold text-base">Block {group.block}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {blockPlots.length} plots · {blockAvailable} avail · {blockSold} sold
                              {blockPlots[0] && <> · {blockPlots[0].sizeUnit === "sqyd" ? "sq yd" : "cents"}</>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {blockAvailable > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                              {blockAvailable}
                            </span>
                          )}
                          {blockReserved > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-medium">
                              {blockReserved}
                            </span>
                          )}
                          {blockSold > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-medium">
                              {blockSold}
                            </span>
                          )}
                          {blockBlocked > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {blockBlocked}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Plot tiles */}
                      <div className="p-3 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2">
                        {blockPlots.map((plot) => {
                          const sc = statusColor[plot.status];
                          const isSelected = openPlotId === plot.id;
                          const dim = filterStatus !== "all" && filterStatus !== plot.status ? 0.3 : 1;
                          return (
                            <button
                              key={plot.id}
                              onClick={() => handlePlotClick(plot)}
                              className={`min-h-[56px] rounded-lg flex flex-col items-center justify-center text-white font-bold text-xs transition hover:scale-105 hover:shadow-lg p-1 ${
                                isSelected ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : ""
                              } ${plot.cornerPlot ? "ring-1 ring-amber-400" : ""}`}
                              style={{ background: sc.hex, opacity: dim }}
                              title={`Plot ${plot.plotNumber} · ${sc.label} · ${plot.size} ${plot.sizeUnit} · ${plot.facing}${plot.cornerPlot ? " · Corner" : ""} · ${inr(plot.totalPrice)}`}
                            >
                              <span className="leading-none text-sm">{plot.plotNumber}</span>
                              <span className="text-[7px] font-medium opacity-90 mt-0.5">{plot.size} {plot.sizeUnit === "sqyd" ? "sqyd" : "c"}</span>
                              <span className="text-[7px] font-medium opacity-75 leading-none mt-0.5">{plot.facing}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Block footer */}
                      <div className="px-3 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Total value: <strong className="text-foreground">{inr(blockPlots.reduce((s, p) => s + p.totalPrice, 0))}</strong></span>
                        <span>Click a plot to view details</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer summary */}
        <div className="px-4 py-3 border-t border-border grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {(["available", "reserved", "booked", "sold", "blocked"] as PlotStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded ${statusColor[s].dot}`} />
              <div>
                <div className="text-muted-foreground text-[10px] uppercase">{statusColor[s].label}</div>
                <div className="font-semibold">{statusCounts[s]}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick plot list (mobile-friendly alternative) */}
      <Card className="p-4 lg:hidden">
        <div className="text-sm font-semibold mb-2">Quick Plot List</div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto">
          {filteredPlots.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpenPlotId(p.id)}
              className="p-1.5 rounded text-[10px] font-semibold text-white"
              style={{ background: statusColor[p.status].hex }}
            >
              {p.plotNumber}
            </button>
          ))}
        </div>
      </Card>

      {/* Plot Export Section — small boxes with plot details */}
      <Card className="overflow-hidden">
        <div className="bg-muted/30 px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <FileBarChart className="w-4 h-4 text-primary" />
              <div className="text-sm font-semibold">Plot Export & Sort</div>
              <span className="text-[10px] text-muted-foreground">({exportFilteredPlots.length} plots)</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sort dropdown */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plotNumber">Sort: Plot No</SelectItem>
                  <SelectItem value="block">Sort: Block</SelectItem>
                  <SelectItem value="size">Sort: Size</SelectItem>
                  <SelectItem value="price">Sort: Price</SelectItem>
                  <SelectItem value="status">Sort: Status</SelectItem>
                  <SelectItem value="facing">Sort: Facing</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortDir} onValueChange={(v) => setSortDir(v as "asc" | "desc")}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
              {/* Export format toggle — Card / Block / Table */}
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "card" | "block" | "table")}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="block">Block</SelectItem>
                  <SelectItem value="table">Table List</SelectItem>
                </SelectContent>
              </Select>
              {/* Export buttons */}
              {permissions?.canExport !== false && (
                <>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportPlotBoxesPDF}>
                    <Printer className="w-3.5 h-3.5 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportPlotBoxesJPG}>
                    <ImageIcon className="w-3.5 h-3.5 mr-1" /> JPG
                  </Button>
                </>
              )}
            </div>
          </div>
          {/* Multi-status filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase text-muted-foreground font-medium">Filter by status:</span>
            {(["available", "booked", "reserved", "sold", "blocked"] as PlotStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => toggleExportStatus(s)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border transition ${
                  exportStatuses.has(s)
                    ? `${statusColor[s].bg} ${statusColor[s].text} border-transparent`
                    : "bg-card border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusColor[s].dot}`} />
                {statusColor[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Plot preview grid — matches the selected export format */}
        <div className="p-3 max-h-[400px] overflow-y-auto">
          {exportFormat === "table" ? (
            /* Table format — full detail per plot */
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold">Plot</th>
                  <th className="px-2 py-2 text-left font-semibold">Block</th>
                  <th className="px-2 py-2 text-left font-semibold">Size</th>
                  <th className="px-2 py-2 text-left font-semibold">Acres</th>
                  <th className="px-2 py-2 text-left font-semibold">Facing</th>
                  <th className="px-2 py-2 text-left font-semibold">Corner</th>
                  <th className="px-2 py-2 text-right font-semibold">Total Price</th>
                  <th className="px-2 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {exportFilteredPlots.map((plot) => {
                  const sc = statusColor[plot.status];
                  return (
                    <tr key={plot.id} className="border-b border-border/60 hover:bg-muted/30 cursor-pointer" onClick={() => setOpenPlotId(plot.id)}>
                      <td className="px-2 py-1.5 font-bold">{plot.plotNumber}</td>
                      <td className="px-2 py-1.5">{plot.block}</td>
                      <td className="px-2 py-1.5">{plot.size} {plot.sizeUnit === "sqyd" ? "sqyd" : "c"}</td>
                      <td className="px-2 py-1.5">{toAcres(plot.size, plot.sizeUnit).toFixed(3)}</td>
                      <td className="px-2 py-1.5">{plot.facing}</td>
                      <td className="px-2 py-1.5">{plot.cornerPlot ? "Yes" : "No"}</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-primary">{inr(plot.totalPrice)}</td>
                      <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[9px] ${sc.bg} ${sc.text}`}>{sc.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : exportFormat === "block" ? (
            /* Block format — grouped by block */
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Block</th>
                  <th className="px-3 py-2 text-left font-semibold">Count</th>
                  <th className="px-3 py-2 text-left font-semibold">Total Area</th>
                  <th className="px-3 py-2 text-left font-semibold">Plot Numbers</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set(exportFilteredPlots.map((p) => p.block))).sort().map((blockName) => {
                  const blockPlots = exportFilteredPlots.filter((p) => p.block === blockName).sort((a, b) => parseInt(a.plotNumber) - parseInt(b.plotNumber));
                  const blockAcres = blockPlots.reduce((s, p) => s + toAcres(p.size, p.sizeUnit), 0).toFixed(3);
                  return (
                    <tr key={blockName} className="border-b border-border/60">
                      <td className="px-3 py-2 font-bold">{blockName}</td>
                      <td className="px-3 py-2">{blockPlots.length}</td>
                      <td className="px-3 py-2">{blockAcres} Acres</td>
                      <td className="px-3 py-2">{blockPlots.map((p) => p.plotNumber).join(", ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* Card format — matches the on-screen plot cards */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {exportFilteredPlots.map((plot) => {
                const sc = statusColor[plot.status];
                const proj = projects.find((p) => p.id === plot.projectId);
                return (
                  <div
                    key={plot.id}
                    className="border-l-4 bg-card rounded-md p-2 text-[10px] shadow-sm cursor-pointer hover:shadow-md transition"
                    style={{ borderLeftColor: sc.hex }}
                    onClick={() => setOpenPlotId(plot.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{plot.plotNumber}</span>
                      <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
                    </div>
                    <div className="text-muted-foreground">Block {plot.block}</div>
                    <div>{plot.size} {plot.sizeUnit === "sqyd" ? "sqyd" : "c"}</div>
                    <div>{toAcres(plot.size, plot.sizeUnit).toFixed(3)} Ac</div>
                    <div>{plot.facing}</div>
                    <div className="font-semibold text-primary">{inr(plot.totalPrice)}</div>
                    <div className="text-[8px] text-muted-foreground mt-0.5 truncate">{proj?.name?.slice(0, 20)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <PlotDetailsPanel plotId={openPlotId} onClose={() => setOpenPlotId(undefined)} />
    </div>
  );
}


