"use client";

/**
 * Admin Company Resources View.
 *
 * Upload brochures, policies, forms, notices — staff see them in
 * the staff portal under the "Resources" tab.
 *
 * Visibility: ALL staff or DEPARTMENT-specific.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FileText, Upload, Trash2, File, Image, FileSpreadsheet, Download,
} from "lucide-react";

type Resource = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string;
  file_type: string;
  file_size: number;
  visibility: string;
  department_filter: string | null;
  status: string;
  uploaded_by: string;
  created_at: string;
};

const CATEGORIES = ["General", "Brochure", "Policy", "Form", "Notice", "Training", "Other"];
const DEPARTMENTS = ["Construction", "HR", "Finance", "Operations", "Design", "Marketing", "IT"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return Image;
  if (fileType.includes("spreadsheet") || fileType.includes("excel")) return FileSpreadsheet;
  return File;
}

export function ResourcesView() {
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/attendance/resources");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function remove(r: Resource) {
    if (!confirm(`Delete "${r.title}"? This will also remove the file from storage.`)) return;
    const res = await fetch(`/api/attendance/resources/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Resource deleted (audit logged)");
      void load();
    } else {
      toast.error("Failed to delete");
    }
  }

  async function download(r: Resource) {
    const res = await fetch(`/api/attendance/resource-url?path=${encodeURIComponent(r.file_path)}`);
    if (res.ok) {
      const { url } = await res.json();
      window.open(url, "_blank");
    } else {
      toast.error("Failed to generate download URL");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Company Resources</h1>
          <p className="text-sm text-muted-foreground">
            Upload brochures, policies, forms, and notices for staff to view in their portal.
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 mr-1" /> Upload Resource
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No resources yet. Upload brochures, policies, or forms for your staff.
                    </TableCell>
                  </TableRow>
                ) : items.map((r) => {
                  const Icon = fileIcon(r.file_type);
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="h-8 w-8 rounded bg-muted grid place-items-center">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.title}</div>
                        {r.description && (
                          <div className="text-xs text-muted-foreground truncate max-w-xs">{r.description}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.category}</Badge>
                      </TableCell>
                      <TableCell>
                        {r.visibility === "ALL" ? (
                          <span className="text-xs">All Staff</span>
                        ) : (
                          <Badge variant="outline" className="bg-sky-100 text-sky-700">
                            {r.department_filter}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">{formatBytes(r.file_size)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => download(r)} title="Download">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(r)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UploadDialog open={showUpload} onOpenChange={setShowUpload} onSaved={() => { setShowUpload(false); void load(); }} />
    </div>
  );
}

function UploadDialog({
  open, onOpenChange, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Brochure",
    visibility: "ALL",
    departmentFilter: "Construction",
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ title: "", description: "", category: "Brochure", visibility: "ALL", departmentFilter: "Construction" });
      setFile(null);
    }
  }, [open]);

  async function save() {
    if (!file) { toast.error("Please select a file"); return; }
    if (!form.title) { toast.error("Please enter a title"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10 MB)"); return; }

    setSaving(true);
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const res = await fetch("/api/attendance/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description || undefined,
            category: form.category,
            visibility: form.visibility,
            departmentFilter: form.visibility === "DEPARTMENT" ? form.departmentFilter : undefined,
            fileData: dataUrl,
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail ?? err.error ?? "Upload failed");
        }
        toast.success("Resource uploaded (audit logged)");
        onSaved();
      };
      reader.onerror = () => { toast.error("Failed to read file"); setSaving(false); };
      reader.readAsDataURL(file);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Company Resource</DialogTitle>
          <DialogDescription>
            Upload brochures, policies, forms, or notices. Staff will see them in their portal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input placeholder="e.g. Employee Handbook 2026" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Optional description..." rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Staff</SelectItem>
                  <SelectItem value="DEPARTMENT">Specific Department</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.visibility === "DEPARTMENT" && (
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={form.departmentFilter} onValueChange={(v) => setForm({ ...form, departmentFilter: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>File * (max 10 MB)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt" />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {formatBytes(file.size)}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !file || !form.title}>
            {saving ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
