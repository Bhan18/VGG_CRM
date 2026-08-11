
"use client";

import { useCrm } from "@/lib/store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Pencil,
  Trash2,
  Map as MapIcon,
  MousePointerClick,
  Upload,
  Layers,
  ChevronRight,
} from "lucide-react";
import { useState, useRef } from "react";
import { formatDate } from "@/lib/format";
import type { Layout } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import type { Permissions } from "@/lib/permissions";

const blank = (projectId: string): Omit<Layout, "id" | "createdAt" | "updatedAt"> => ({
  projectId,
  name: "",
  image: "",
  description: "",
  numberOfPlots: 0,
});

export default function LayoutsPage({ permissions }: { permissions?: Permissions }) {
  const {
    projects,
    layouts,
    plots,
    addLayout,
    updateLayout,
    deleteLayout,
    setRoute,
    selectedProjectId,
  } = useCrm();
  const { toast } = useToast();

  const [activeProjectId, setActiveProjectId] = useState<string>(selectedProjectId || projects[0]?.id || "");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank(activeProjectId));
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const projectLayouts = layouts.filter((l) => l.projectId === activeProjectId);
  const activeProject = projects.find((p) => p.id === activeProjectId);

  const openAdd = () => {
    setEditingId(null);
    setForm(blank(activeProjectId));
    setDialogOpen(true);
  };

  const openEdit = (l: Layout) => {
    setEditingId(l.id);
    setForm({
      projectId: l.projectId,
      name: l.name,
      image: l.image ?? "",
      description: l.description ?? "",
      numberOfPlots: l.numberOfPlots,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Layout name is required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateLayout(editingId, form);
      toast({ title: "Layout updated", description: form.name });
    } else {
      addLayout(form);
      toast({ title: "Layout created", description: `${form.name} added to ${activeProject?.name}` });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const l = layouts.find((x) => x.id === deleteId);
    deleteLayout(deleteId);
    toast({ title: "Layout deleted", description: l?.name, variant: "destructive" });
    setDeleteId(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5MB for layout images", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, image: reader.result as string }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Layouts"
        description="Each project can have unlimited layouts (phases). Upload a master layout image and overlay clickable plots in the Interactive Layout view."
        actions={
          permissions?.canCreateLayouts !== false ? (
            <Button onClick={openAdd} className="bg-primary" disabled={!activeProjectId}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Layout
            </Button>
          ) : undefined
        }
      />

      {/* Project selector tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveProjectId(p.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
              activeProjectId === p.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:bg-muted/50"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {activeProject && (
        <Card className="p-4 bg-muted/30 border-dashed">
          <div className="flex items-start gap-3">
            <Layers className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-sm">{activeProject.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {activeProject.location} · {projectLayouts.length} layout{projectLayouts.length !== 1 ? "s" : ""} · {plots.filter((p) => p.projectId === activeProjectId).length} total plots
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {projectLayouts.length} / unlimited
            </Badge>
          </div>
        </Card>
      )}

      {/* Layouts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projectLayouts.map((l) => {
          const layoutPlots = plots.filter((p) => p.layoutId === l.id);
          const sold = layoutPlots.filter((p) => p.status === "sold").length;
          const available = layoutPlots.filter((p) => p.status === "available").length;
          const soldPct = layoutPlots.length > 0 ? (sold / layoutPlots.length) * 100 : 0;
          return (
            <Card key={l.id} className="overflow-hidden metric-card">
              <div className="h-44 bg-gradient-to-br from-primary/10 via-muted to-accent/10 relative">
                {l.image ? (
                  <img src={l.image} alt={l.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <MapIcon className="w-12 h-12 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 bg-background/90 backdrop-blur text-[11px]"
                    onClick={() => setRoute("interactive-layout", { selectedProjectId: l.projectId, selectedLayoutId: l.id })}
                  >
                    <MousePointerClick className="w-3 h-3 mr-1" /> Open
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-base">{l.name}</h3>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Created {formatDate(l.createdAt)}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {layoutPlots.length} / {l.numberOfPlots || "∞"} plots
                  </Badge>
                </div>

                {l.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{l.description}</p>
                )}

                {/* Sales progress */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Sold</span>
                    <span className="font-semibold">{soldPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500" style={{ width: `${soldPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1 text-muted-foreground">
                    <span className="text-emerald-700">{available} available</span>
                    <span className="text-rose-700">{sold} sold</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setRoute("interactive-layout", { selectedProjectId: l.projectId, selectedLayoutId: l.id })}
                  >
                    <MousePointerClick className="w-3.5 h-3.5 mr-1" /> Interactive <ChevronRight className="w-3 h-3 ml-0.5" />
                  </Button>
                  {permissions?.canEditLayouts !== false && (
                    <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => openEdit(l)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {permissions?.canDeleteLayouts && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-rose-600 hover:bg-rose-50"
                      onClick={() => setDeleteId(l.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {projectLayouts.length === 0 && (
        <Card className="p-12 text-center">
          <MapIcon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <div className="font-semibold">No layouts in this project</div>
          <div className="text-sm text-muted-foreground mt-1">
            Click &ldquo;Add Layout&rdquo; to create a phase (Phase 1, Phase 2, Extension, etc.).
          </div>
        </Card>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Layout" : "Add New Layout"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update layout details and master image."
                : `Add a new layout (phase) to ${activeProject?.name ?? "the project"}. You can add unlimited layouts.`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label htmlFor="lname">Layout Name *</Label>
              <Input
                id="lname"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Phase 1, Phase 2, Extension Layout"
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                Future-ready: add Phase 2, Phase 3, Farm 2, Farm 3 anytime without code changes.
              </div>
            </div>
            <div>
              <Label htmlFor="lplots">Expected Number of Plots</Label>
              <NumberInput
                value={form.numberOfPlots}
                onValueChange={(v) => setForm((f) => ({ ...f, numberOfPlots: v }))}
                placeholder="e.g. 48"
              />
            </div>
            <div>
              <Label>Master Layout Image</Label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Image
                </Button>
                {form.image && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 text-rose-600"
                    onClick={() => setForm((f) => ({ ...f, image: "" }))}
                  >
                    Remove
                  </Button>
                )}
              </div>
              {form.image ? (
                <div className="mt-2 w-full h-40 rounded-md overflow-hidden border border-border">
                  <img src={form.image} alt="preview" className="w-full h-full object-contain bg-muted/30" />
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Upload the master layout (architect/PDF image). Plots will be overlaid on this image as clickable rectangles.
                  If no image is uploaded, a schematic grid is generated automatically.
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="ldesc">Description</Label>
              <Textarea
                id="ldesc"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief layout description..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-primary">
              {editingId ? "Save Changes" : "Create Layout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this layout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the layout and all its plots. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


