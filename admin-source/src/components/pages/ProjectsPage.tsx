
"use client";

import { useCrm, parsePlotRange, loadBlockConfig } from "@/lib/store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  LayoutGrid,
  CircleCheck,
  Clock,
  Archive,
  Map as MapIcon,
  Grid3x3,
  X,
  Compass,
  CornerDownRight,
  IndianRupee,
  Settings2,
  RotateCcw,
} from "lucide-react";
import { useState, useRef } from "react";
import { formatDate, allFacings } from "@/lib/format";
import type { Project, BlockConfig, FacingDirection, Plot, ProjectPricingDefaults } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { NumberInput } from "@/components/ui/number-input";
import type { Permissions } from "@/lib/permissions";

const statusConfig: Record<Project["status"], { label: string; color: string; icon: typeof Clock }> = {
  active: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CircleCheck },
  planned: { label: "Planned", color: "bg-sky-50 text-sky-700 border-sky-200", icon: Clock },
  completed: { label: "Completed", color: "bg-amber-50 text-amber-700 border-amber-200", icon: CircleCheck },
  archived: { label: "Archived", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Archive },
};

const blank: Omit<Project, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  location: "",
  totalArea: "",
  numberOfPlots: 0,
  status: "active",
  description: "",
  layoutImage: "",
};

// Default block configs — completely empty, no prefilled values
const defaultBlocks = (): BlockConfig[] => [
  {
    name: "A",
    plotRange: "",
    defaultFacing: "North",
    cornerPlots: "",
    defaultSize: 0,
    defaultPricePerUnit: 0,
    roadWidth: 0,
    facingAssignments: {},
    sizeOverrides: {},
    priceOverrides: {},
  },
];

// Default project-level pricing — empty, no prefilled values
const defaultPricing = (): ProjectPricingDefaults => ({
  areaUnit: "cents",
  cornerPremium: 0,
  facingPremiums: {},
});

// Block letter generator: A, B, C, ... Z, AA, AB, ...
function blockName(idx: number): string {
  let s = "";
  let n = idx;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// ============================================================
// PLOT CONFIGURATION MANAGER
// 3-Layer approach:
//   Layer 1: Block defaults (applies to all plots)
//   Layer 2: Bulk select + assign (apply to group)
//   Layer 3: CSV paste import (for complex per-plot data)
// ============================================================

interface PlotRowData {
  num: number;
  facing: FacingDirection;
  size: number;
  price: number;
  corner: boolean;
  customized: boolean;
}

// 1 cent = 48.40 sq yd. For cents projects the price fields show a ₹/sq.yd input first
// and auto-fill the ₹/cent equivalent (= ₹/sq.yd × 48.4) so the total stays consistent.
const SQYD_PER_CENT = 48.4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Price input that matches the project's land unit.
 * - areaUnit "sqyd": single ₹/sq.yd input.
 * - areaUnit "cents": shows a ₹/sq.yd input FIRST and auto-fills ₹/cent below it.
 *   The stored value stays in ₹/cent (the project's unit), derived from the sq.yd entry.
 */
function PriceUnitField({
  areaUnit,
  value,
  onValueChange,
  inputClassName = "h-8 text-sm",
}: {
  areaUnit: "cents" | "sqyd";
  /** Stored per-unit price — ₹/cent when areaUnit is "cents", ₹/sq.yd when "sqyd". */
  value: number;
  onValueChange: (v: number) => void;
  inputClassName?: string;
}) {
  if (areaUnit !== "cents") {
    return <NumberInput value={value} onValueChange={onValueChange} format className={inputClassName} />;
  }
  const sqyd = round2(value / SQYD_PER_CENT);
  return (
    <div className="space-y-0.5">
      <div className="relative">
        <NumberInput
          value={sqyd}
          onValueChange={(v) => onValueChange(Math.round(v * SQYD_PER_CENT))}
          allowDecimal
          format
          className={`${inputClassName} pr-11`}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground pointer-events-none">
          ₹/sq.yd
        </span>
      </div>
      <div className="text-[15px] text-muted-foreground  leading-none truncate" title={`₹${value.toLocaleString("en-IN")}/cent`}>
        ₹{value.toLocaleString("en-IN")}/cent
      </div>
    </div>
  );
}

function PlotFacingAssigner({ block, onChange, areaUnit }: {
  block: BlockConfig;
  onChange: (patch: Partial<Pick<BlockConfig, "facingAssignments" | "sizeOverrides" | "priceOverrides" | "cornerPlots">>) => void;
  areaUnit: "cents" | "sqyd";
}) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"bulk" | "corners" | "csv" | "table">("bulk");
  const [selectedPlots, setSelectedPlots] = useState<Set<number>>(new Set());
  const [bulkFacing, setBulkFacing] = useState<FacingDirection | "">("");
  const [bulkSize, setBulkSize] = useState<string>("");
  const [bulkPrice, setBulkPrice] = useState<number>(0);
  const [csvText, setCsvText] = useState<string>("");
  const plotNums = parsePlotRange(block.plotRange);
  const facingAssignments = block.facingAssignments ?? {};
  const cornerNums = parsePlotRange(block.cornerPlots);

  // Build plot data table from current config
  const plotRows: PlotRowData[] = plotNums.map((n) => {
    const facing = facingAssignments[n] ?? block.defaultFacing;
    const size = block.sizeOverrides?.[n] ?? block.defaultSize;
    const price = block.priceOverrides?.[n] ?? block.defaultPricePerUnit;
    const corner = cornerNums.includes(n);
    const customized = !!facingAssignments[n] || block.sizeOverrides?.[n] !== undefined || block.priceOverrides?.[n] !== undefined;
    return { num: n, facing, size, price, corner, customized };
  });

  const togglePlot = (n: number) => {
    const next = new Set(selectedPlots);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setSelectedPlots(next);
  };

  const selectAll = () => setSelectedPlots(new Set(plotNums));
  const selectNone = () => setSelectedPlots(new Set());

  // Layer 2: Bulk assign
  const applyAllChanges = () => {
    if (selectedPlots.size === 0) return;
    const patches: Partial<Pick<BlockConfig, "facingAssignments" | "sizeOverrides" | "priceOverrides">> = {};
    if (bulkFacing) {
      const nextFa = { ...facingAssignments };
      selectedPlots.forEach((n) => { nextFa[n] = bulkFacing as FacingDirection; });
      patches.facingAssignments = nextFa;
    }
    if (bulkSize) {
      const nextSo = { ...(block.sizeOverrides ?? {}) };
      selectedPlots.forEach((n) => { nextSo[n] = parseFloat(bulkSize) || 0; });
      patches.sizeOverrides = nextSo;
    }
    if (bulkPrice) {
      const nextPo = { ...(block.priceOverrides ?? {}) };
      selectedPlots.forEach((n) => { nextPo[n] = bulkPrice; });
      patches.priceOverrides = nextPo;
    }
    if (Object.keys(patches).length > 0) onChange(patches);
    setBulkFacing(""); setBulkSize(""); setBulkPrice(0);
    setSelectedPlots(new Set());
  };

  // Layer 3: CSV paste import
  const applyCsvImport = () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split("\n");
    const nextFa = { ...facingAssignments };
    const nextSo = { ...(block.sizeOverrides ?? {}) };
    const nextPo = { ...(block.priceOverrides ?? {}) };
    const cornerSet = new Set(cornerNums);
    let imported = 0;

    for (const line of lines) {
      const parts = line.split(/[,\t]/).map((s) => s.trim());
      if (parts.length < 2) continue;

      // Skip header row if present
      const firstCol = parts[0].toLowerCase();
      if (firstCol === "plot" || firstCol === "plotno" || firstCol === "plot_no" || firstCol === "#") continue;

      const num = parseInt(parts[0]);
      if (isNaN(num) || !plotNums.includes(num)) continue;

      // Column order: Plot, Facing, Size, Price, Corner
      if (parts[1]) {
        const f = allFacings.find((af) => af.toLowerCase() === parts[1].toLowerCase());
        if (f) nextFa[num] = f;
      }
      if (parts[2]) {
        const sz = parseFloat(parts[2]);
        if (!isNaN(sz)) nextSo[num] = sz;
      }
      if (parts[3]) {
        const pr = parseInt(parts[3].replace(/[^\d]/g, ""));
        if (!isNaN(pr)) nextPo[num] = pr;
      }
      if (parts[4]) {
        const c = parts[4].toLowerCase();
        if (c === "yes" || c === "y" || c === "1" || c === "true") cornerSet.add(num);
        else if (c === "no" || c === "n" || c === "0" || c === "false") cornerSet.delete(num);
      }
      imported++;
    }

    onChange({
      facingAssignments: nextFa,
      sizeOverrides: nextSo,
      priceOverrides: nextPo,
      cornerPlots: Array.from(cornerSet).sort((a, b) => a - b).join(", "),
    });
    setCsvText("");
  };

  const clearPlotAssignments = (n: number) => {
    const nextFa = { ...facingAssignments }; delete nextFa[n];
    const nextSo = { ...(block.sizeOverrides ?? {}) }; delete nextSo[n];
    const nextPo = { ...(block.priceOverrides ?? {}) }; delete nextPo[n];
    onChange({ facingAssignments: nextFa, sizeOverrides: nextSo, priceOverrides: nextPo });
  };

  const clearAll = () => {
    onChange({ facingAssignments: {}, sizeOverrides: {}, priceOverrides: {}, cornerPlots: "" });
  };

  const customizedCount = plotRows.filter((r) => r.customized).length;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-[11px] font-medium text-primary hover:underline"
      >
        <span className="flex items-center gap-1">
          <Settings2 className="w-3 h-3" />
          Plot Configuration ({customizedCount} customized of {plotNums.length})
        </span>
        <span>{expanded ? "▲ Hide" : "▼ Show"}</span>
      </button>

      {expanded && (
        <div className="mt-2 p-3 rounded-lg border border-border bg-muted/20" onClick={(e) => e.stopPropagation()}>
          {/* Mode tabs */}
          <div className="flex items-center gap-1 mb-3 flex-wrap">
            <button type="button" onClick={() => setMode("bulk")} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition ${mode === "bulk" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted/50"}`}>Bulk Assign</button>
            <button type="button" onClick={() => setMode("corners")} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition flex items-center gap-1 ${mode === "corners" ? "bg-amber-500 text-white" : "bg-card border border-border hover:bg-muted/50"}`}>
              Corners
              {cornerNums.length > 0 && (
                <span className={`px-1 rounded text-[9px] ${mode === "corners" ? "bg-white/30" : "bg-amber-100 text-amber-700"}`}>{cornerNums.length}</span>
              )}
            </button>
            <button type="button" onClick={() => setMode("csv")} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition ${mode === "csv" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted/50"}`}>CSV Paste</button>
            <button type="button" onClick={() => setMode("table")} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition ${mode === "table" ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted/50"}`}>Plot Table</button>
            {customizedCount > 0 && (
              <button type="button" onClick={clearAll} className="ml-auto text-[10px] text-rose-600 hover:underline">Reset All</button>
            )}
          </div>

          {/* Mode: Bulk Assign */}
          {mode === "bulk" && (
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1.5">
                Click plot numbers to select ({selectedPlots.size} selected). Then set values below and click Apply.
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <button type="button" onClick={selectAll} className="text-[10px] text-primary hover:underline">Select All</button>
                <span className="text-[10px] text-muted-foreground">·</span>
                <button type="button" onClick={selectNone} className="text-[10px] text-primary hover:underline">Clear</button>
                <span className="text-[10px] text-muted-foreground ml-auto font-semibold">{selectedPlots.size} of {plotNums.length}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3 max-h-32 overflow-y-auto p-1">
                {plotRows.map((r) => {
                  const isSelected = selectedPlots.has(r.num);
                  return (
                    <button
                      key={r.num}
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePlot(r.num); }}
                      className={`min-w-[30px] h-7 px-1.5 rounded text-[10px] font-bold transition ${
                        isSelected ? "bg-primary text-primary-foreground ring-2 ring-accent"
                        : r.customized ? "bg-violet-100 text-violet-800 border border-violet-300 hover:bg-violet-200"
                        : r.corner ? "bg-amber-50 text-amber-700 border border-amber-300"
                        : "bg-card border border-border hover:bg-muted/60"
                      }`}
                      title={`Plot ${r.num} · ${r.facing} · ${r.size} ${areaUnit} · ₹${r.price}${r.corner ? " · Corner" : ""}${r.customized ? " · Customized" : ""}`}
                    >
                      {r.num}
                    </button>
                  );
                })}
              </div>

              {selectedPlots.size > 0 && (
                <div className="p-2 rounded-md bg-card border border-border space-y-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase">Apply to {selectedPlots.size} plot{selectedPlots.size !== 1 ? "s" : ""}:</div>
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <Label className="text-[9px] uppercase">Facing</Label>
                      <Select value={bulkFacing} onValueChange={(v) => setBulkFacing(v as FacingDirection)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose…" /></SelectTrigger>
                        <SelectContent>{allFacings.map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[9px] uppercase">Size ({areaUnit})</Label>
                      <Input type="number" step="0.1" value={bulkSize} onChange={(e) => setBulkSize(e.target.value)} className="h-8 text-xs" placeholder="e.g. 3.5" />
                    </div>
                    <div>
                      <Label className="text-[9px] uppercase">Base Price</Label>
                      <PriceUnitField
                        areaUnit={areaUnit}
                        value={bulkPrice}
                        onValueChange={setBulkPrice}
                        inputClassName="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <Button type="button" size="sm" className="w-full h-9 text-xs bg-primary" onClick={applyAllChanges} disabled={!bulkFacing && !bulkSize && !bulkPrice}>Apply Changes & Deselect</Button>
                </div>
              )}
            </div>
          )}

          {/* Mode: Corners — dedicated section for corner plots with facing dropdown + area field */}
          {mode === "corners" && (
            <div>
              {cornerNums.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground bg-muted/30 rounded-md border border-dashed">
                  No corner plots defined for this block.
                  <br />
                  Enter corner plot numbers (e.g. <code>1, 5, 9</code>) in the "Corner Plots" field above to configure them here.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase text-muted-foreground">
                      Configure each corner plot's facing &amp; area. Changes apply instantly.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        // Reset all corner overrides
                        const nextFa = { ...facingAssignments };
                        const nextSo = { ...(block.sizeOverrides ?? {}) };
                        cornerNums.forEach((n) => { delete nextFa[n]; delete nextSo[n]; });
                        onChange({ facingAssignments: nextFa, sizeOverrides: nextSo });
                      }}
                      className="text-[10px] text-rose-600 hover:underline"
                    >
                      Reset corners
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {cornerNums.map((n) => {
                      const currentFacing = facingAssignments[n] ?? block.defaultFacing;
                      const currentSize = block.sizeOverrides?.[n] ?? block.defaultSize;
                      const isOverridden = !!facingAssignments[n] || block.sizeOverrides?.[n] !== undefined;
                      return (
                        <div key={n} className="flex items-center gap-2 p-2 rounded-md border border-amber-200 bg-amber-50/40">
                          <div className="w-10 h-10 rounded-md bg-amber-500 text-white grid place-items-center font-bold text-sm shrink-0">
                            {n}
                          </div>
                          <div className="flex-1 text-[10px] text-muted-foreground">
                            Corner Plot
                          </div>
                          <div className="w-36">
                            <Label className="text-[9px] uppercase text-muted-foreground block mb-0.5">Corner Facing</Label>
                            <Select
                              value={currentFacing}
                              onValueChange={(v) => {
                                const nextFa = { ...facingAssignments, [n]: v as FacingDirection };
                                onChange({ facingAssignments: nextFa });
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {/* Corner plots typically face the intersection — show all facings */}
                                {allFacings.map((f) => (
                                  <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="w-24">
                            <Label className="text-[9px] uppercase text-muted-foreground block mb-0.5">Area ({areaUnit === "sqyd" ? "sq yd" : "cents"})</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={currentSize || ""}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                const nextSo = { ...(block.sizeOverrides ?? {}), [n]: isNaN(v) ? 0 : v };
                                onChange({ sizeOverrides: nextSo });
                              }}
                              className="h-7 text-xs"
                              placeholder="e.g. 4.5"
                            />
                          </div>
                          {isOverridden && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const nextFa = { ...facingAssignments }; delete nextFa[n];
                                const nextSo = { ...(block.sizeOverrides ?? {}) }; delete nextSo[n];
                                onChange({ facingAssignments: nextFa, sizeOverrides: nextSo });
                              }}
                              className="text-[9px] text-rose-600 hover:underline shrink-0"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2 p-1.5 rounded bg-amber-50/60 border border-amber-200/60">
                    <strong>Tip:</strong> Corner plots automatically get the project-level Corner Premium added to their price.
                    Set the premium in the "Project Pricing Defaults" box above.
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mode: CSV Paste */}
          {mode === "csv" && (
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1.5">
                Paste from Excel/Sheets. Format: Plot, Facing, Size, Price, Corner
              </div>
              <div className="text-[9px] text-muted-foreground mb-2 p-2 rounded bg-muted/40 font-mono">
                Example:<br />
                1,East,3.5,28000,Yes<br />
                2,West,3.5,26000,No<br />
                3,North,4.0,30000,Yes
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={6}
                className="w-full p-2 text-xs font-mono rounded-md border border-border bg-card focus:ring-2 focus:ring-primary/10 outline-none"
                placeholder="Plot,Facing,Size,Price,Corner&#10;1,East,3.5,28000,Yes&#10;2,West,3.5,26000,No"
              />
              <Button type="button" size="sm" className="w-full h-9 text-xs bg-primary mt-2" onClick={applyCsvImport} disabled={!csvText.trim()}>Import CSV Data</Button>
            </div>
          )}

          {/* Mode: Plot Table — visual overview */}
          {mode === "table" && (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold">Plot</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Facing</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Size</th>
                    <th className="px-2 py-1.5 text-right font-semibold">₹/unit</th>
                    <th className="px-2 py-1.5 text-center font-semibold">Corner</th>
                    <th className="px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {plotRows.map((r) => (
                    <tr key={r.num} className={`border-b border-border/50 hover:bg-muted/30 ${r.customized ? "bg-violet-50/30" : ""}`}>
                      <td className="px-2 py-1.5 font-bold">{r.num}</td>
                      <td className="px-2 py-1.5">{r.facing}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.size}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.price.toLocaleString("en-IN")}</td>
                      <td className="px-2 py-1.5 text-center">{r.corner ? "✓" : ""}</td>
                      <td className="px-2 py-1.5 text-right">
                        {r.customized && (
                          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearPlotAssignments(r.num); }} className="text-[9px] text-rose-600 hover:underline">Reset</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage({ permissions }: { permissions?: Permissions }) {
  const {
    projects,
    layouts,
    plots,
    addProject,
    addProjectWithBlocks,
    updateProject,
    updateProjectWithBlocks,
    deleteProject,
    restoreProject,
    permanentlyDeleteProject,
    deletePlot,
    deleteLayout,
    setRoute,
  } = useCrm();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [blocks, setBlocks] = useState<BlockConfig[]>(defaultBlocks());
  const [useBlocks, setUseBlocks] = useState(true);
  const [pricing, setPricing] = useState<ProjectPricingDefaults>(defaultPricing());
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Split into active and deleted (recycle bin — show 5 most recent)
  const activeProjects = projects.filter((p) => !p.isDeleted);
  const deletedProjects = projects
    .filter((p) => p.isDeleted)
    .sort((a, b) => new Date(b.deletedAt ?? 0).getTime() - new Date(a.deletedAt ?? 0).getTime())
    .slice(0, 5);

  const openAdd = () => {
    setEditingId(null);
    setForm(blank);
    setBlocks(defaultBlocks());
    setUseBlocks(true);
    setPricing(defaultPricing());
    setDialogOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      location: p.location,
      totalArea: p.totalArea,
      numberOfPlots: p.numberOfPlots,
      status: p.status,
      description: p.description ?? "",
      layoutImage: p.layoutImage ?? "",
    });
    setUseBlocks(true);

    // ---- Restore block config + pricing ----
    // Priority 1: read from localStorage cache (saved when the project was created/updated).
    //             This gives back the EXACT values the user entered — no double-counting.
    // Priority 2: reverse-engineer from existing plots (fallback for projects created
    //             before the cache existed, or edited on a different browser).
    const cached = loadBlockConfig(p.id);
    if (cached) {
      setBlocks(cached.blocks);
      setPricing(cached.pricing);
    } else {
      // Reverse-engineer from plots. CRITICAL: subtract facing + corner premiums from
      // each plot's pricePerCent to recover the original base price, otherwise premiums
      // would be added a second time on save (the "price keeps incrementing" bug).
      const projectPlots = plots.filter((pl) => pl.projectId === p.id);
      if (projectPlots.length > 0) {
        // Group plots by block
        const blocksMap: Record<string, Plot[]> = {};
        projectPlots.forEach((plot) => {
          (blocksMap[plot.block] ||= []).push(plot);
        });

        // Detect area unit from first plot
        const areaUnit = (projectPlots[0].sizeUnit as "cents" | "sqyd") || "cents";

        // Detect premiums: find the minimum pricePerCent among non-corner plots per facing.
        // The minimum price for each facing = base + facingPremium. The global minimum
        // across all facings = base. So facingPremium = (min for that facing) - base.
        // cornerPremium = (min corner price for a facing) - (min non-corner price for same facing).
        const nonCornerByFacing: Record<string, number[]> = {};
        const cornerByFacing: Record<string, number[]> = {};
        projectPlots.forEach((plot) => {
          const key = plot.facing;
          if (plot.cornerPlot) {
            (cornerByFacing[key] ||= []).push(plot.pricePerCent);
          } else {
            (nonCornerByFacing[key] ||= []).push(plot.pricePerCent);
          }
        });
        const nonCornerMins: Record<string, number> = {};
        Object.entries(nonCornerByFacing).forEach(([f, arr]) => {
          nonCornerMins[f] = Math.min(...arr);
        });
        // Base = the lowest non-corner min across all facings (facing with no premium, or lowest premium)
        const baseCandidates = Object.values(nonCornerMins);
        const detectedBase = baseCandidates.length > 0 ? Math.min(...baseCandidates) : projectPlots[0].pricePerCent;
        // Facing premiums
        const detectedFacingPremiums: Partial<Record<FacingDirection, number>> = {};
        Object.entries(nonCornerMins).forEach(([f, min]) => {
          const premium = min - detectedBase;
          if (premium > 0) {
            detectedFacingPremiums[f as FacingDirection] = premium;
          }
        });
        // Corner premium: compare corner vs non-corner for same facing
        let detectedCornerPremium = 0;
        for (const [f, cornerArr] of Object.entries(cornerByFacing)) {
          if (nonCornerMins[f] !== undefined && cornerArr.length > 0) {
            const cornerMin = Math.min(...cornerArr);
            const diff = cornerMin - nonCornerMins[f];
            if (diff > 0 && diff !== detectedCornerPremium) {
              detectedCornerPremium = diff;
            }
          }
        }

        const reconstructedBlocks: BlockConfig[] = Object.keys(blocksMap).sort().map((blockName) => {
          const blockPlots = blocksMap[blockName].sort((a, b) =>
            parseInt(a.plotNumber.replace(/[^\d]/g, ""), 10) - parseInt(b.plotNumber.replace(/[^\d]/g, ""), 10),
          );
          const plotNums = blockPlots.map((pp) => parseInt(pp.plotNumber, 10));
          const firstPlot = blockPlots[0];
          const cornerPlots = blockPlots.filter((pp) => pp.cornerPlot).map((pp) => parseInt(pp.plotNumber, 10));
          // Recover base price for THIS plot = pricePerCent - facingPremium - cornerPremium
          const recoverBase = (pp: Plot): number => {
            const fp = detectedFacingPremiums[pp.facing] ?? 0;
            const cp = pp.cornerPlot ? detectedCornerPremium : 0;
            return Math.max(0, pp.pricePerCent - fp - cp);
          };
          const firstBase = recoverBase(firstPlot);
          return {
            name: blockName,
            plotRange: plotNums.join(", "),
            defaultFacing: firstPlot.facing as FacingDirection,
            cornerPlots: cornerPlots.join(", "),
            defaultSize: firstPlot.size,
            defaultPricePerUnit: firstBase,
            roadWidth: firstPlot.roadWidth,
            facingAssignments: Object.fromEntries(blockPlots.map((pp) => [parseInt(pp.plotNumber, 10), pp.facing])),
            sizeOverrides: Object.fromEntries(blockPlots.filter((pp) => pp.size !== firstPlot.size).map((pp) => [parseInt(pp.plotNumber, 10), pp.size])),
            priceOverrides: Object.fromEntries(
              blockPlots
                .filter((pp) => recoverBase(pp) !== firstBase)
                .map((pp) => [parseInt(pp.plotNumber, 10), recoverBase(pp)]),
            ),
          };
        });
        setBlocks(reconstructedBlocks.length > 0 ? reconstructedBlocks : defaultBlocks());
        setPricing({
          areaUnit,
          cornerPremium: detectedCornerPremium,
          facingPremiums: detectedFacingPremiums,
        });
      } else {
        setBlocks(defaultBlocks());
        setPricing(defaultPricing());
      }
    }
    setDialogOpen(true);
  };

  // Computed: total plots from block config
  const totalPlotsFromBlocks = blocks.reduce((sum, b) => sum + parsePlotRange(b.plotRange).length, 0);

  const updateBlock = (idx: number, patch: Partial<BlockConfig>) => {
    setBlocks((bs) => bs.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const addBlock = () => {
    setBlocks((bs) => [
      ...bs,
      {
        name: blockName(bs.length),
        plotRange: "",
        defaultFacing: "North",
        cornerPlots: "",
        defaultSize: 0,
        defaultPricePerUnit: 0,
        roadWidth: 0,
        facingAssignments: {},
        sizeOverrides: {},
        priceOverrides: {},
      },
    ]);
  };

  const removeBlock = (idx: number) => {
    setBlocks((bs) => bs.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Project name is required", variant: "destructive" });
      return;
    }
    try {
      if (editingId) {
        // If blocks are present and useBlocks is true, update plots using updateProjectWithBlocks
        // (NOT addProjectWithBlocks which creates a duplicate project).
        // The store updates local state synchronously and persists to Supabase in the
        // background (parallelized). We close the dialog immediately so the UI feels
        // instant; any Supabase failure is surfaced via the promise catch below.
        if (useBlocks && blocks.length > 0 && totalPlotsFromBlocks > 0) {
          updateProjectWithBlocks(editingId, form, blocks, "Phase 1", pricing)
            .catch((e) => {
              const msg = e instanceof Error ? e.message : "Unknown error";
              toast({ title: "Error saving project", description: msg, variant: "destructive" });
            });
          toast({ title: "Project updated with plots", description: `${form.name} · ${blocks.length} blocks · ${totalPlotsFromBlocks} plots` });
        } else {
          updateProject(editingId, form);
          toast({ title: "Project updated", description: form.name });
        }
      } else if (useBlocks && blocks.length > 0 && totalPlotsFromBlocks > 0) {
        // Validate block configs
        for (const b of blocks) {
          if (parsePlotRange(b.plotRange).length === 0) {
            toast({ title: `Block ${b.name} has no valid plots`, description: "Enter a plot range like 1-10, 12, 15", variant: "destructive" });
            return;
          }
        }
        // Deduplicate block names
        const names = blocks.map((b) => b.name);
        if (new Set(names).size !== names.length) {
          toast({ title: "Duplicate block names", description: "Each block must have a unique name.", variant: "destructive" });
          return;
        }
        addProjectWithBlocks(
          { ...form, numberOfPlots: totalPlotsFromBlocks },
          blocks,
          "Phase 1",
          pricing,
        ).catch((e) => {
          const msg = e instanceof Error ? e.message : "Unknown error";
          toast({ title: "Error creating project", description: msg, variant: "destructive" });
        });
        toast({
          title: "Project created with plots",
          description: `${form.name} · ${blocks.length} blocks · ${totalPlotsFromBlocks} plots auto-generated`,
        });
      } else {
        addProject(form);
        toast({ title: "Project created", description: `${form.name} added successfully` });
      }
      // Always close dialog + reset form after a successful save. The local store state is
      // already updated synchronously by the store action, so the UI reflects the change
      // instantly while Supabase syncs in the background.
      setDialogOpen(false);
      setForm(blank);
      setBlocks(defaultBlocks());
      setPricing(defaultPricing());
      setEditingId(null);
    } catch (e) {
      // Sync failures (e.g. duplicate block names) surface here — keep the dialog open.
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({
        title: "Error saving project",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const p = projects.find((x) => x.id === deleteId);
    deleteProject(deleteId);
    toast({ title: "Project moved to Recycle Bin", description: p?.name });
    setDeleteId(null);
  };

  const handleRestore = (id: string) => {
    restoreProject(id);
    const p = projects.find((x) => x.id === id);
    toast({ title: "Project restored", description: p?.name });
  };

  const handlePermanentDelete = () => {
    if (!permanentDeleteId) return;
    const p = projects.find((x) => x.id === permanentDeleteId);
    permanentlyDeleteProject(permanentDeleteId);
    toast({ title: "Project permanently deleted", description: p?.name, variant: "destructive" });
    setPermanentDeleteId(null);
  };

  const handleClearAll = () => {
    deletedProjects.forEach((p) => permanentlyDeleteProject(p.id));
    toast({ title: "All deleted projects permanently removed", variant: "destructive" });
    setShowRecycleBin(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 2MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, layoutImage: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Projects"
        description="Manage all real estate projects. Each project can contain unlimited layouts (phases)."
        actions={
          permissions?.canCreateProjects !== false ? (
            <Button onClick={openAdd} className="bg-primary">
              <Plus className="w-4 h-4 mr-1.5" /> Add Project
            </Button>
          ) : undefined
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Projects</div>
          <div className="text-xl font-bold mt-1">{activeProjects.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Active</div>
          <div className="text-xl font-bold mt-1 text-emerald-700">
            {activeProjects.filter((p) => p.status === "active").length}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Planned</div>
          <div className="text-xl font-bold mt-1 text-sky-700">
            {activeProjects.filter((p) => p.status === "planned").length}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Plots</div>
          <div className="text-xl font-bold mt-1">{plots.length}</div>
        </Card>
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeProjects.map((p) => {
          const projectLayouts = layouts.filter((l) => l.projectId === p.id);
          const projectPlots = plots.filter((pl) => pl.projectId === p.id);
          const sold = projectPlots.filter((pl) => pl.status === "sold").length;
          const sc = statusConfig[p.status];
          const SIcon = sc.icon;
          return (
            <Card key={p.id} className="overflow-hidden metric-card">
              {/* Header image / placeholder */}
              <div
                className="h-36 bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 relative cursor-pointer"
                onClick={() => setRoute("layouts", { selectedProjectId: p.id })}
              >
                {p.layoutImage ? (
                  <img src={p.layoutImage} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="w-16 h-16 rounded-2xl bg-background/80 backdrop-blur grid place-items-center">
                      <Building2 className="w-7 h-7 text-primary/70" />
                    </div>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Badge variant="outline" className={`text-[10px] bg-background/90 ${sc.color}`}>
                    <SIcon className="w-3 h-3 mr-1" />
                    {sc.label}
                  </Badge>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base truncate">{p.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{p.location}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <div className="text-[10px] uppercase text-muted-foreground">Area</div>
                    <div className="text-sm font-semibold">{p.totalArea || "—"}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <div className="text-[10px] uppercase text-muted-foreground">Plots</div>
                    <div className="text-sm font-semibold">{p.numberOfPlots}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <div className="text-[10px] uppercase text-muted-foreground">Sold</div>
                    <div className="text-sm font-semibold text-rose-600">{sold}</div>
                  </div>
                </div>

                {p.description && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{p.description}</p>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="text-[11px] text-muted-foreground">
                    <MapIcon className="w-3 h-3 inline mr-1" />
                    {projectLayouts.length} layout{projectLayouts.length !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => setRoute("layouts", { selectedProjectId: p.id })}
                    >
                      <LayoutGrid className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                    {permissions?.canEditProjects !== false && (
                      <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => openEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {permissions?.canDeleteProjects && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-rose-600 hover:bg-rose-50"
                        onClick={() => setDeleteId(p.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {activeProjects.length === 0 && deletedProjects.length === 0 && (
        <Card className="p-12 text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <div className="font-semibold">No projects yet</div>
          <div className="text-sm text-muted-foreground mt-1">Click &ldquo;Add Project&rdquo; to get started.</div>
        </Card>
      )}

      {/* Recycle Bin — at the bottom, 5 most recent deletions */}
      {deletedProjects.length > 0 && (
        <Card className="p-4 border-amber-300 bg-amber-50/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-amber-700" />
              <div className="font-semibold text-amber-900">Recent Deletions ({deletedProjects.length})</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setShowRecycleBin((v) => !v)}>
                {showRecycleBin ? "Hide" : "Show"}
              </Button>
              {showRecycleBin && (
                <Button variant="ghost" size="sm" className="h-7 text-[11px] text-rose-600 hover:bg-rose-50" onClick={handleClearAll}>
                  <Trash2 className="w-3 h-3 mr-1" /> Clear All
                </Button>
              )}
            </div>
          </div>
          {showRecycleBin && (
            <div className="space-y-2">
              {deletedProjects.map((p) => {
                const projectLayouts = layouts.filter((l) => l.projectId === p.id);
                const projectPlots = plots.filter((pl) => pl.projectId === p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-md border border-amber-200 bg-background">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.location} · {projectLayouts.length} layouts · {projectPlots.length} plots
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Deleted: {p.deletedAt ? new Date(p.deletedAt).toLocaleString("en-IN") : "—"}
                        {p.deletedBy && ` · by ${p.deletedBy}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8" onClick={() => handleRestore(p.id)}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-rose-600 hover:bg-rose-50" onClick={() => setPermanentDeleteId(p.id)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Forever
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Project" : "Add New Project"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update project details. Block configuration cannot be changed after creation."
                : "Create a new project with blocks and auto-generated plots. A default Phase 1 layout is created automatically."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 max-h-[68vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Vijaya Sandalwood Farm Phase 3"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Anekal Taluk, Bengaluru Rural"
                />
              </div>
              <div>
                <Label htmlFor="area">Total Area (Acres)</Label>
                <Input
                  id="area"
                  value={form.totalArea}
                  onChange={(e) => setForm((f) => ({ ...f, totalArea: e.target.value }))}
                  placeholder="e.g. 12.5 Acres"
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Project["status"] }))}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="image">Project Cover Image</Label>
                <input
                  ref={fileRef}
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => fileRef.current?.click()}>
                    Upload
                  </Button>
                  {form.layoutImage && (
                    <Button type="button" variant="ghost" size="sm" className="h-9 text-rose-600" onClick={() => setForm((f) => ({ ...f, layoutImage: "" }))}>
                      Remove
                    </Button>
                  )}
                </div>
                {form.layoutImage && (
                  <div className="mt-2 w-full h-24 rounded-md overflow-hidden border border-border">
                    <img src={form.layoutImage} alt="preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief project description..."
                />
              </div>
            </div>

            {/* Block Configuration (new + edit mode) */}
            {(useBlocks || !editingId) && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Grid3x3 className="w-4 h-4 text-primary" />
                    <div>
                      <div className="text-sm font-semibold">Block Configuration</div>
                      <div className="text-[11px] text-muted-foreground">
                        Define blocks and the plot numbers they contain. Plots are auto-generated with the facing, size, and corner settings you choose.
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBlocks}
                      onChange={(e) => setUseBlocks(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    Auto-generate plots
                  </label>
                </div>

                {useBlocks && (
                  <>
                    {/* Project-level pricing defaults — shared across all blocks */}
                    <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/60">
                      <div className="text-[10px] uppercase font-semibold text-amber-800 mb-2 flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" /> Project Pricing Defaults (applies to all blocks)
                      </div>
                      <div className="grid grid-cols-12 gap-2 mb-2">
                        <div className="col-span-3">
                          <Label className="text-[10px] uppercase">Land Unit</Label>
                          <Select
                            value={pricing.areaUnit}
                            onValueChange={(v) => setPricing((p) => ({ ...p, areaUnit: v as "cents" | "sqyd" }))}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cents">Cents</SelectItem>
                              <SelectItem value="sqyd">Sq Yd</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-4">
                          <Label className="text-[10px] uppercase">
                            Corner Premium
                          </Label>
                          <PriceUnitField
                            areaUnit={pricing.areaUnit}
                            value={pricing.cornerPremium}
                            onValueChange={(v) => setPricing((p) => ({ ...p, cornerPremium: v }))}
                            inputClassName="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">
                        Facing Premiums
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(["East", "North", "South", "West", "North-East", "North-West", "South-East", "South-West"] as FacingDirection[]).map((f) => (
                          <div key={f}>
                            <Label className="text-[9px] uppercase text-muted-foreground block truncate" title={f}>{f}</Label>
                            <PriceUnitField
                              areaUnit={pricing.areaUnit}
                              value={pricing.facingPremiums?.[f] ?? 0}
                              onValueChange={(v) =>
                                setPricing((p) => ({ ...p, facingPremiums: { ...p.facingPremiums, [f]: v } }))
                              }
                              inputClassName="h-7 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                      <div className="text-xs">
                        <span className="font-semibold text-base text-primary">{blocks.length}</span> block{blocks.length !== 1 ? "s" : ""}
                        {totalPlotsFromBlocks > 0 && (
                          <>
                            <span className="mx-2 text-muted-foreground">·</span>
                            <span className="font-semibold text-base text-primary">{totalPlotsFromBlocks}</span> plots will be created
                          </>
                        )}
                      </div>
                      {/* Add Block button ALWAYS visible — even when no blocks exist */}
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={addBlock}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Block
                      </Button>
                    </div>

                    {blocks.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                        No blocks yet. Click "Add Block" to create your first block.
                      </div>
                    )}

                    {blocks.map((b, idx) => {
                      const plotCount = parsePlotRange(b.plotRange).length;
                      const cornerCount = parsePlotRange(b.cornerPlots).length;
                      return (
                        <div key={idx} className="border border-border rounded-lg p-3 bg-card relative">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold text-sm">
                                {b.name}
                              </div>
                              <div>
                                <div className="text-sm font-semibold">Block {b.name}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {plotCount} plots · {cornerCount} corner
                                </div>
                              </div>
                            </div>
                            {blocks.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50"
                                onClick={() => removeBlock(idx)}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>

                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-2">
                              <Label className="text-[10px] uppercase">Block Name</Label>
                              <Input
                                value={b.name}
                                onChange={(e) => updateBlock(idx, { name: e.target.value.toUpperCase().slice(0, 3) })}
                                className="h-8 text-sm font-semibold"
                                maxLength={3}
                              />
                            </div>
                            <div className="col-span-5">
                              <Label className="text-[10px] uppercase">Plot Range</Label>
                              <Input
                                value={b.plotRange}
                                onChange={(e) => updateBlock(idx, { plotRange: e.target.value })}
                                placeholder="1-10, 12, 15"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-5">
                              <Label className="text-[10px] uppercase flex items-center gap-1">
                                <CornerDownRight className="w-2.5 h-2.5" /> Corner Plots
                              </Label>
                              <Input
                                value={b.cornerPlots}
                                onChange={(e) => updateBlock(idx, { cornerPlots: e.target.value })}
                                placeholder="1, 10, 15"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-3">
                              <Label className="text-[10px] uppercase flex items-center gap-1">
                                <Compass className="w-2.5 h-2.5" /> Default Facing
                              </Label>
                              <Select
                                value={b.defaultFacing}
                                onValueChange={(v) => updateBlock(idx, { defaultFacing: v as FacingDirection })}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {allFacings.map((f) => (
                                    <SelectItem key={f} value={f}>{f}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px] uppercase">Size ({pricing.areaUnit === "sqyd" ? "sq yd" : "cents"})</Label>
                              <NumberInput
                                value={b.defaultSize}
                                onValueChange={(v) => updateBlock(idx, { defaultSize: v })}
                                allowDecimal
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-[10px] uppercase">
                                Base Price
                              </Label>
                              <PriceUnitField
                                areaUnit={pricing.areaUnit}
                                value={b.defaultPricePerUnit}
                                onValueChange={(v) => updateBlock(idx, { defaultPricePerUnit: v })}
                                inputClassName="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-3">
                              <Label className="text-[10px] uppercase">Road (ft)</Label>
                              <NumberInput
                                value={b.roadWidth}
                                onValueChange={(v) => updateBlock(idx, { roadWidth: v })}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* Plot Configuration Manager */}
                          <PlotFacingAssigner
                            block={b}
                            onChange={(patch) => updateBlock(idx, patch)}
                            areaUnit={pricing.areaUnit}
                          />

                          {/* Plot preview chips */}
                          {plotCount > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {parsePlotRange(b.plotRange).slice(0, 30).map((n) => {
                                const isCorner = parsePlotRange(b.cornerPlots).includes(n);
                                const facing = b.facingAssignments?.[n] ?? b.defaultFacing;
                                const size = b.sizeOverrides?.[n] ?? b.defaultSize;
                                const price = b.priceOverrides?.[n] ?? b.defaultPricePerUnit;
                                const isCustomized = !!b.facingAssignments?.[n] || b.sizeOverrides?.[n] !== undefined || b.priceOverrides?.[n] !== undefined;
                                const fPremium = pricing.facingPremiums?.[facing] ?? 0;
                                const cPremium = isCorner ? (pricing.cornerPremium ?? 0) : 0;
                                const effPrice = price + fPremium + cPremium;
                                const effTotal = Math.round(size * effPrice);
                                return (
                                  <span
                                    key={n}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                      isCustomized
                                        ? "bg-violet-100 text-violet-800 border border-violet-300"
                                        : isCorner
                                        ? "bg-amber-100 text-amber-800 border border-amber-300"
                                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    }`}
                                    title={`Plot ${n} · ${facing} · ${size} ${pricing.areaUnit === "sqyd" ? "sq yd" : "cents"} · ₹${effPrice}/${pricing.areaUnit === "sqyd" ? "sq yd" : "cent"} · Total ₹${effTotal.toLocaleString("en-IN")}${isCustomized ? " (customized)" : ""}`}
                                  >
                                    {n}
                                  </span>
                                );
                              })}
                              {plotCount > 30 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] text-muted-foreground">
                                  +{plotCount - 30} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="text-[11px] text-muted-foreground p-2 rounded-md bg-muted/30">
                      <strong>Tip:</strong> Use comma-separated ranges like <code>1-10, 12, 15</code> for plot numbers.
                      Block A with range <code>1-3</code> creates plots <strong>1, 2, 3</strong>.
                      Corner plots get an amber highlight. Premiums are absolute ₹/cent amounts added to the base price —
                      e.g., base ₹25,000/cent + East facing premium ₹3,000 + corner premium ₹5,000 = ₹33,000/cent effective price.
                      Use <strong>Customize Plots</strong> in each block to override facing/size/price for individual plots.
                    </div>
                  </>
                )}
              </>
            )}

            {/* Edit mode: show plot count manually */}
            {editingId && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="plots">Number of Plots</Label>
                  <NumberInput
                    value={form.numberOfPlots}
                    onValueChange={(v) => setForm((f) => ({ ...f, numberOfPlots: v }))}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} className="bg-primary">
              {editingId ? "Save Changes" : useBlocks ? `Create Project & ${totalPlotsFromBlocks} Plots` : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This project will be moved to the Recycle Bin. You can restore it later from the Recent Deletions section on this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent delete confirmation */}
      <AlertDialog open={!!permanentDeleteId} onOpenChange={(o) => !o && setPermanentDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The project and all its layouts and plots will be permanently removed. Customers, bookings, and payments are NOT affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


