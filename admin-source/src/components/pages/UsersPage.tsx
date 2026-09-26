
"use client";

import { useCrm } from "@/lib/store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
import { Plus, Pencil, Trash2, Shield, Crown, Eye, Megaphone, UserCheck, Lock } from "lucide-react";
import { useState } from "react";
import type { User, UserRole } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { formatDate } from "@/lib/format";

const roleConfig: Record<UserRole, { label: string; icon: typeof Crown; color: string; description: string }> = {
  administrator: {
    label: "Administrator",
    icon: Crown,
    color: "bg-rose-50 text-rose-700 border-rose-200",
    description: "Complete access: all modules, settings, user management, roles & passwords.",
  },
  sales_manager: {
    label: "Sales Manager",
    icon: Shield,
    color: "bg-sky-50 text-sky-700 border-sky-200",
    description: "Manage bookings, sales, payments, and customer data. No settings access.",
  },
  marketing: {
    label: "Marketing",
    icon: Megaphone,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    description: "View projects, plots, and customers. Can add/edit customers and record payments.",
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    color: "bg-slate-100 text-slate-700 border-slate-200",
    description: "View all dashboards and reports. Can add customers and record payments. Cannot edit projects/plots.",
  },
};

const blank = { name: "", email: "", password: "", role: "viewer" as UserRole, active: true };

export default function UsersPage() {
  const { users, currentUserId, addUser, updateUser, deleteUser, setCurrentUser, reloadUsers } = useCrm();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [resetPwdId, setResetPwdId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditingId(null);
    setForm(blank);
    setDialogOpen(true);
  };
  const openEdit = (u: User) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, role: u.role, active: u.active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast({ title: "Name and email required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        // Update existing user profile (role/name/active)
        updateUser(editingId, { name: form.name, role: form.role, active: form.active });
        // Also update Supabase user_profiles table
        const { supabase } = await import("@/lib/supabase-client");
        await supabase.from("user_profiles").update({
          name: form.name, role: form.role, active: form.active,
        }).eq("id", editingId);
        toast({ title: "User updated" });
      } else {
        // Create new user via admin API (server-side, uses service role key)
        if (!form.password || form.password.length < 6) {
          toast({ title: "Password must be at least 6 characters", variant: "destructive" });
          setSaving(false);
          return;
        }
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email, password: form.password, name: form.name, role: form.role,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create user");
        }
        toast({ title: "User created", description: `${form.name} (${form.email})` });
        // Reload users from Supabase
        reloadUsers();
      }
      setDialogOpen(false);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwdId || !newPassword || newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetPwdId, password: newPassword }),
      });
      if (!res.ok) throw new Error("Failed to reset password");
      toast({ title: "Password reset", description: "The user can now sign in with the new password" });
      setResetPwdId(null);
      setNewPassword("");
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    if (deleteId === currentUserId) {
      toast({ title: "Cannot delete current user", variant: "destructive" });
      setDeleteId(null);
      return;
    }
    const u = users.find((x) => x.id === deleteId);
    deleteUser(deleteId);
    toast({ title: "User deleted", description: u?.name, variant: "destructive" });
    setDeleteId(null);
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: "name",
      header: "User",
      sortable: true,
      sortValue: (u) => u.name,
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
              {u.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-sm flex items-center gap-1.5">
              {u.name}
              {u.id === currentUserId && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  You
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (u) => u.role,
      render: (u) => {
        const r = roleConfig[u.role];
        const Icon = r.icon;
        return (
          <Badge variant="outline" className={`text-[10px] ${r.color}`}>
            <Icon className="w-3 h-3 mr-1" />
            {r.label}
          </Badge>
        );
      },
    },
    {
      key: "active",
      header: "Status",
      render: (u) => (
        <Badge variant="outline" className={`text-[10px] ${u.active ? "bg-emerald-50 text-emerald-700 border-transparent" : "bg-slate-100 text-slate-700 border-transparent"}`}>
          {u.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Joined",
      sortable: true,
      sortValue: (u) => u.createdAt,
      render: (u) => <span className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (u) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-[11px]" onClick={() => setCurrentUser(u.id)} disabled={u.id === currentUserId}>
            <UserCheck className="w-3.5 h-3.5 mr-1" /> Sign in as
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(u)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
            onClick={() => setDeleteId(u.id)}
            disabled={u.id === currentUserId}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Users & Roles"
        description="Manage CRM users and their access levels. Four role tiers control what each user can do."
        actions={
          <Button onClick={openAdd} className="bg-primary">
            <Plus className="w-4 h-4 mr-1.5" /> Add User
          </Button>
        }
      />

      {/* Role overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(roleConfig) as UserRole[]).map((r) => {
          const cfg = roleConfig[r];
          const Icon = cfg.icon;
          const count = users.filter((u) => u.role === r).length;
          return (
            <Card key={r} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg grid place-items-center ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <Badge variant="outline" className="text-[10px]">{count} user{count !== 1 ? "s" : ""}</Badge>
              </div>
              <div className="font-semibold text-sm">{cfg.label}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{cfg.description}</div>
            </Card>
          );
        })}
      </div>

      <DataTable
        title="All Users"
        columns={columns}
        rows={users}
        searchPlaceholder="Search by name or email..."
        searchKeys={["name", "email"]}
        exportFilename="vgg-users"
        pageSize={10}
        onRowClick={(u) => openEdit(u)}
      />

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} disabled={!!editingId} />
            </div>
            {!editingId && (
              <div>
                <Label className="text-xs">Password * (min 6 characters)</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
              </div>
            )}
            {editingId && (
              <div className="p-2 rounded-md bg-amber-50 border border-amber-200">
                <div className="text-[11px] text-amber-800 mb-1.5">
                  <Lock className="w-3 h-3 inline mr-1" />
                  Reset this user&apos;s password:
                </div>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={resetPwdId === editingId ? newPassword : ""}
                    onChange={(e) => { setResetPwdId(editingId); setNewPassword(e.target.value); }}
                    placeholder="New password"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={resetPwdId !== editingId || !newPassword || newPassword.length < 6 || saving}
                    onClick={handleResetPassword}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleConfig) as UserRole[]).map((r) => {
                    const cfg = roleConfig[r];
                    const Icon = cfg.icon;
                    return (
                      <SelectItem key={r} value={r}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" />
                          <span>{cfg.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground mt-1.5 p-2 rounded-md bg-muted/40">
                {roleConfig[form.role].description}
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded-md border border-border">
              <div>
                <Label className="text-xs">Active</Label>
                <div className="text-[11px] text-muted-foreground">Inactive users cannot sign in</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              The user record will be permanently removed.
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


