
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, Loader2, AlertCircle,
  Search, Save, Globe,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  fetchRows, createRow, updateRow, deleteRow, reorderRows, type Row,
} from "@/lib/content/crud";
import {
  CONTENT_TABLES, type ContentTableConfig, type FieldConfig,
} from "@/lib/content/content-tables";
import { cn } from "@/lib/utils";

export default function WebsiteContentPage() {
  const [activeId, setActiveId] = useState<string>(CONTENT_TABLES[0].id);
  const activeConfig = CONTENT_TABLES.find((c) => c.id === activeId) ?? CONTENT_TABLES[0];

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Website Content"
        description="Manage all content shown on the public website. Changes appear on the site within 30-60 seconds."
      />

      <div className="grid lg:grid-cols-[260px_1fr] gap-5">
        {/* Left: content type tabs */}
        <Card className="p-2 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] overflow-hidden">
          <div className="px-2 py-2 mb-1 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content Types</span>
          </div>
          <ScrollArea className="h-[calc(100vh-12rem)] lg:h-[calc(100vh-12rem)]">
            <div className="space-y-0.5 pr-2">
              {CONTENT_TABLES.map((c) => {
                const active = c.id === activeId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-secondary"
                    )}
                    title={c.description}
                  >
                    {c.title}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        {/* Right: editor for the active content type */}
        <div className="min-w-0">
          <ContentEditor key={activeConfig.id} config={activeConfig} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Content Editor — table + form + CRUD for one content type
// ============================================================
function ContentEditor({ config }: { config: ContentTableConfig }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchRows(config.table);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load. Make sure Supabase is configured and the migration has been run.");
    } finally {
      setLoading(false);
    }
  }, [config.table]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    return Object.values(r).some((v) =>
      String(v ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  const handleAdd = () => {
    const empty: Row = {};
    config.fields.forEach((f) => {
      empty[f.key] = f.default ?? (f.type === "boolean" ? false : f.type === "number" ? 0 : "");
    });
    empty.order = rows.length;
    setEditing(empty);
    setFormOpen(true);
  };

  const handleEdit = (row: Row) => {
    setEditing({ ...row });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    for (const f of config.fields) {
      if (f.required && !editing[f.key]) {
        toast({ title: "Validation error", description: `${f.label} is required`, variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const { id, created_at, ...patch } = editing;
      if (id) {
        await updateRow(config.table, id as string, patch);
        toast({ title: "Updated", description: `${config.singular} updated successfully` });
      } else {
        await createRow(config.table, patch);
        toast({ title: "Created", description: `${config.singular} added successfully` });
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error. Check Supabase config.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteRow(config.table, deleteId);
      toast({ title: "Deleted", description: `${config.singular} deleted` });
      setDeleteId(null);
      await load();
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleToggleActive = async (row: Row, value: boolean) => {
    try {
      await updateRow(config.table, row.id as string, { active: value });
      await load();
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const moveRow = async (idx: number, dir: "up" | "down") => {
    const newRows = [...filtered];
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newRows.length) return;
    [newRows[idx], newRows[targetIdx]] = [newRows[targetIdx], newRows[idx]];
    const orderedIds = newRows.map((r) => r.id as string);
    setRows((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]));
      const reordered = orderedIds.map((id, i) => ({ ...(map.get(id) as Row), order: i }));
      const filteredIds = new Set<string>(orderedIds);
      const others = prev.filter((r) => !filteredIds.has(r.id as string));
      return [...reordered, ...others];
    });
    try {
      await reorderRows(config.table, orderedIds);
      toast({ title: "Reordered", description: "Order updated" });
    } catch (e) {
      toast({ title: "Reorder failed", variant: "destructive" });
      await load();
    }
  };

  const tableFields = config.fields.filter((f) => !f.hideInTable).slice(0, 4);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight">{config.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{config.description}</p>
        </div>
        <Button onClick={handleAdd} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Add {config.singular}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Error */}
      {error && (
        <Card className="p-4 border-destructive/30 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-destructive mb-1">Cannot load {config.title.toLowerCase()}</p>
            <p className="text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Make sure you have run <code className="px-1 py-0.5 rounded bg-secondary">scripts/supabase-migration.sql</code> in your Supabase SQL Editor.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>Retry</Button>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="mb-3">No {config.title.toLowerCase()} yet.</p>
            <Button onClick={handleAdd} variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Add your first {config.singular.toLowerCase()}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3 text-left font-semibold w-16">#</th>
                  {tableFields.map((f) => (
                    <th key={f.key} className="p-3 text-left font-semibold">{f.label}</th>
                  ))}
                  {config.hasActiveToggle && <th className="p-3 text-center font-semibold w-24">Active</th>}
                  <th className="p-3 text-right font-semibold w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => (
                  <tr key={row.id as string} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{idx + 1}</span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => moveRow(idx, "up")}
                            disabled={idx === 0}
                            className="text-muted-foreground hover:text-primary disabled:opacity-30"
                            aria-label="Move up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveRow(idx, "down")}
                            disabled={idx === filtered.length - 1}
                            className="text-muted-foreground hover:text-primary disabled:opacity-30"
                            aria-label="Move down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    {tableFields.map((f) => (
                      <td key={f.key} className="p-3 max-w-xs">
                        <CellRenderer field={f} value={row[f.key]} />
                      </td>
                    ))}
                    {config.hasActiveToggle && (
                      <td className="p-3 text-center">
                        <Switch
                          checked={Boolean(row.active)}
                          onCheckedChange={(v) => handleToggleActive(row, v)}
                        />
                      </td>
                    )}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(row)} aria-label="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(row.id as string)} aria-label="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? `Edit ${config.singular}` : `Add ${config.singular}`}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid sm:grid-cols-2 gap-4 py-2">
              {config.fields.map((f) => (
                <FieldRenderer
                  key={f.key}
                  field={f}
                  value={editing[f.key]}
                  onChange={(v) => setEditing({ ...editing, [f.key]: v })}
                />
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {config.singular.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The item will be permanently removed from your Supabase database and the public website.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Field renderer — matches the admin's shadcn/ui style
// ============================================================
function FieldRenderer({
  field, value, onChange,
}: { field: FieldConfig; value: unknown; onChange: (v: unknown) => void }) {
  const labelEl = (
    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
      {field.label} {field.required && <span className="text-destructive">*</span>}
    </Label>
  );
  const wrapperClass = cn(field.fullWidth && "sm:col-span-2");

  switch (field.type) {
    case "text":
      return (
        <div className={wrapperClass}>
          {labelEl}
          <Input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
          {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      );
    case "url":
      return (
        <div className={wrapperClass}>
          {labelEl}
          <Input
            type="url"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? "https://..."}
            required={field.required}
          />
          {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      );
    case "textarea":
      return (
        <div className={wrapperClass}>
          {labelEl}
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            required={field.required}
          />
          {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      );
    case "number":
      return (
        <div className={wrapperClass}>
          {labelEl}
          <Input
            type="number"
            value={(value as number) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder={field.placeholder}
            required={field.required}
          />
          {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      );
    case "date":
      return (
        <div className={wrapperClass}>
          {labelEl}
          <Input
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </div>
      );
    case "boolean":
      return (
        <div className={wrapperClass}>
          <div className="flex items-center gap-3 h-9">
            <Switch checked={Boolean(value)} onCheckedChange={onChange} />
            <span className="text-sm">{field.label}</span>
          </div>
          {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      );
    case "select":
      return (
        <div className={wrapperClass}>
          {labelEl}
          <Select value={(value as string) ?? ""} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder ?? "Select..."} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      );
    case "image":
      return (
        <div className={wrapperClass}>
          {labelEl}
          <div className="flex gap-3">
            <Input
              type="url"
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder ?? "https://images..."}
              required={field.required}
              className="flex-1"
            />
            {value ? (
              <div className="w-14 h-14 rounded-lg overflow-hidden border flex-shrink-0 bg-muted">
                <img src={value as string} alt="Preview" className="w-full h-full object-cover" />
              </div>
            ) : null}
          </div>
          {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      );
    default:
      return null;
  }
}

// ============================================================
// Cell renderer — compact display in table rows
// ============================================================
function CellRenderer({ field, value }: { field: FieldConfig; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/40">—</span>;
  }
  if (field.type === "image") {
    return (
      <div className="w-12 h-12 rounded-lg overflow-hidden border bg-muted flex-shrink-0">
        <img src={value as string} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  if (field.type === "boolean") {
    return value ? <Badge className="bg-emerald-500/20 text-emerald-700 border-0">Yes</Badge> : <Badge variant="outline">No</Badge>;
  }
  if (field.type === "textarea") {
    return <span className="line-clamp-2 text-muted-foreground">{String(value)}</span>;
  }
  const str = String(value);
  if (str.length > 60) return <span className="line-clamp-2">{str}</span>;
  return <span className="font-medium">{str}</span>;
}

