
"use client";

import { useCrm } from "@/lib/store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  IdCard,
  Briefcase,
  User,
  Search,
  Users,
  Building,
  Eye,
  Filter,
  IndianRupee,
  Wallet,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { formatDate, inr } from "@/lib/format";
import type { Customer } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const blank: Omit<Customer, "id" | "createdAt" | "updatedAt"> = {
  name: "",
  fatherName: "",
  motherName: "",
  phone: "",
  alternatePhone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  pinCode: "",
  occupation: "",
  pan: "",
  aadhaar: "",
  photo: "",
  remarks: "",
};

export default function CustomersPage({ permissions }: { permissions?: { canCreateCustomers: boolean; canEditCustomers: boolean; canDeleteCustomers: boolean; canExport: boolean } }) {
  const { customers, plots, sales, bookings, payments, projects, addCustomer, updateCustomer, deleteCustomer, setRoute, prefillCustomer, clearPrefill } = useCrm();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [buyerMode, setBuyerMode] = useState<"new" | "existing">("new");
  const [existingCustomerId, setExistingCustomerId] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterState, setFilterState] = useState<string>("all");
  const [filterCity, setFilterCity] = useState<string>("all");
  const [spendMin, setSpendMin] = useState<string>("");
  const [spendMax, setSpendMax] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [minPlots, setMinPlots] = useState<string>("");

  // Derived: cities and states from customers
  const cities = useMemo(() => Array.from(new Set(customers.map((c) => c.city).filter(Boolean))).sort(), [customers]);
  const states = useMemo(() => Array.from(new Set(customers.map((c) => c.state).filter(Boolean))).sort(), [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      // By default, only show customers with bookings (referenceCode generated)
      if (!showAllCustomers && !c.hasBooking) return false;
      // Text search
      if (q) {
        const matches = [c.name, c.phone, c.alternatePhone, c.email, c.pan, c.aadhaar, c.city, c.referenceCode]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q));
        if (!matches) return false;
      }
      // Project filter
      if (filterProject !== "all" && !plots.some((p) => p.customerId === c.id && p.projectId === filterProject)) return false;
      // State filter
      if (filterState !== "all" && c.state !== filterState) return false;
      // City filter
      if (filterCity !== "all" && c.city !== filterCity) return false;
      // Spend range
      const spend = sales.filter((s) => s.customerId === c.id).reduce((sum, s) => sum + s.saleAmount, 0);
      if (spendMin && spend < parseFloat(spendMin)) return false;
      if (spendMax && spend > parseFloat(spendMax)) return false;
      // Date range (customer creation date)
      if (dateFrom && new Date(c.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(c.createdAt) > new Date(dateTo + "T23:59:59")) return false;
      // Min plots
      if (minPlots && plots.filter((p) => p.customerId === c.id).length < parseInt(minPlots)) return false;
      return true;
    });
  }, [customers, query, filterProject, filterState, filterCity, spendMin, spendMax, dateFrom, dateTo, minPlots, plots, sales, showAllCustomers]);

  const clearFilters = () => {
    setFilterProject("all");
    setFilterState("all");
    setFilterCity("all");
    setSpendMin("");
    setSpendMax("");
    setDateFrom("");
    setDateTo("");
    setMinPlots("");
  };

  const activeFilterCount = [
    filterProject !== "all", filterState !== "all", filterCity !== "all",
    spendMin, spendMax, dateFrom, dateTo, minPlots,
  ].filter(Boolean).length;

  const openAdd = () => {
    setEditingId(null);
    setForm(blank);
    setBuyerMode("new");
    setExistingCustomerId("");
    setDialogOpen(true);
  };
  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({ ...blank, ...c });
    setBuyerMode("new");
    setExistingCustomerId("");
    setDialogOpen(true);
  };

  // Auto-open Add Customer dialog when arriving via the "Add Buyer" flow from a vacant plot
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (prefillCustomer) {
      setEditingId(null);
      setForm(blank);
      setBuyerMode("new");
      setExistingCustomerId("");
      setDialogOpen(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [prefillCustomer]);

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Customer name is required", variant: "destructive" });
      return;
    }
    if (!form.phone.trim()) {
      toast({ title: "Phone number is required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateCustomer(editingId, form);
      toast({ title: "Customer updated", description: form.name });
      setDialogOpen(false);
    } else if (prefillCustomer) {
      // Add Buyer flow — capture the new customer ID and forward to the booking form
      const newId = addCustomer(form);
      useCrm.setState({
        prefillCustomer: null,
        prefillBooking: {
          plotId: prefillCustomer.plotId,
          customerId: newId,
          projectId: prefillCustomer.projectId,
          layoutId: prefillCustomer.layoutId,
        },
      });
      toast({ title: "Customer added", description: form.name });
      setDialogOpen(false);
      setRoute("bookings");
    } else {
      addCustomer(form);
      toast({ title: "Customer added", description: form.name });
      setDialogOpen(false);
    }
  };

  // Choose-existing-customer path of the Add Buyer flow
  const handleNextExisting = () => {
    if (!existingCustomerId) {
      toast({ title: "Select a customer", variant: "destructive" });
      return;
    }
    if (!prefillCustomer) return;
    useCrm.setState({
      prefillCustomer: null,
      prefillBooking: {
        plotId: prefillCustomer.plotId,
        customerId: existingCustomerId,
        projectId: prefillCustomer.projectId,
        layoutId: prefillCustomer.layoutId,
      },
    });
    setDialogOpen(false);
    setRoute("bookings");
  };

  // Cancel button — when in the Add Buyer flow, reset all prefill context
  const handleDialogCancel = () => {
    if (prefillCustomer) {
      clearPrefill();
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    const c = customers.find((x) => x.id === deleteId);
    deleteCustomer(deleteId);
    toast({ title: "Customer deleted", description: c?.name, variant: "destructive" });
    setDeleteId(null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 1MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: reader.result as string }));
    reader.readAsDataURL(file);
  };

  // Plot ownership lookup
  const customerPlots = (cid: string) => plots.filter((p) => p.customerId === cid);

  const columns: DataTableColumn<Customer>[] = [
    {
      key: "referenceCode",
      header: "Ref Code",
      sortable: true,
      sortValue: (c) => c.referenceCode ?? "",
      render: (c) => (
        c.referenceCode ? (
          <div className="font-mono text-[11px] font-semibold text-primary">{c.referenceCode}</div>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">No booking yet</span>
        )
      ),
    },
    {
      key: "name",
      header: "Customer",
      sortable: true,
      sortValue: (c) => c.name,
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="w-8 h-8">
            {c.photo ? (
              <img src={c.photo} alt={c.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="text-[10px] bg-primary/15 text-primary">
                {c.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{c.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{c.phone}</div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (c) => (
        <div className="text-xs">
          {c.email && <div className="truncate max-w-[180px]">{c.email}</div>}
          {c.city && <div className="text-muted-foreground">{c.city}, {c.state}</div>}
        </div>
      ),
    },
    {
      key: "pan",
      header: "PAN / Aadhaar",
      render: (c) => (
        <div className="text-xs">
          <div>{c.pan || "—"}</div>
          <div className="text-muted-foreground">{c.aadhaar || "—"}</div>
        </div>
      ),
    },
    {
      key: "plots",
      header: "Plots",
      sortable: true,
      sortValue: (c) => customerPlots(c.id).length,
      render: (c) => {
        const cps = customerPlots(c.id);
        return (
          <Badge variant="outline" className="text-[10px]">
            {cps.length} plot{cps.length !== 1 ? "s" : ""}
          </Badge>
        );
      },
    },
    {
      key: "createdAt",
      header: "Added",
      sortable: true,
      sortValue: (c) => c.createdAt,
      render: (c) => <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (c) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setViewId(c.id)}>
            <Eye className="w-3.5 h-3.5" />
          </Button>
          {permissions?.canEditCustomers !== false && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(c)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {permissions?.canDeleteCustomers && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
              onClick={() => setDeleteId(c.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const viewCustomer = customers.find((c) => c.id === viewId);

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Customers"
        description="Maintain buyer information. A customer can own multiple plots across projects."
        actions={
          permissions?.canCreateCustomers !== false && (
            <Button onClick={openAdd} className="bg-primary">
              <Plus className="w-4 h-4 mr-1.5" /> Add Customer
            </Button>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Customers</div>
          <div className="text-xl font-bold mt-1">{customers.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">With Bookings</div>
          <div className="text-xl font-bold mt-1 text-sky-700">
            {customers.filter((c) => bookings.some((b) => b.customerId === c.id)).length}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">With Sales</div>
          <div className="text-xl font-bold mt-1 text-rose-700">
            {customers.filter((c) => sales.some((s) => s.customerId === c.id)).length}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Multi-plot Owners</div>
          <div className="text-xl font-bold mt-1 text-primary">
            {customers.filter((c) => customerPlots(c.id).length > 1).length}
          </div>
        </Card>
      </div>

      {/* Filter toolbar */}
      <Card className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1">
            <Filter className="w-3.5 h-3.5" /> Filters
            {activeFilterCount > 0 && (
              <Badge variant="outline" className="text-[9px] ml-1 bg-primary/10 text-primary border-primary/20">
                {activeFilterCount} active
              </Badge>
            )}
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
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
          <Select value={filterState} onValueChange={setFilterState}>
            <SelectTrigger className="h-9 w-32 text-xs">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {states.map((s) => (
                <SelectItem key={s} value={s as string}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="h-9 w-32 text-xs">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c as string}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <IndianRupee className="w-3.5 h-3.5 text-muted-foreground" />
            <Input
              type="number"
              placeholder="Min spend"
              value={spendMin}
              onChange={(e) => setSpendMin(e.target.value)}
              className="h-9 w-24 text-xs"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="number"
              placeholder="Max"
              value={spendMax}
              onChange={(e) => setSpendMax(e.target.value)}
              className="h-9 w-20 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 text-xs"
              title="Added from"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 text-xs"
              title="Added to"
            />
          </div>
          <Input
            type="number"
            placeholder="Min plots"
            value={minPlots}
            onChange={(e) => setMinPlots(e.target.value)}
            className="h-9 w-24 text-xs"
            title="Minimum plots owned"
          />
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
              Clear ({activeFilterCount})
            </Button>
          )}
        </div>
      </Card>

      <DataTable
        title={`Customers${showAllCustomers ? " (All)" : " (With Bookings)"}${activeFilterCount > 0 ? ` · ${filtered.length} matched` : ` · ${filtered.length}`}`}
        columns={columns}
        rows={filtered}
        searchPlaceholder="Search by name, phone, PAN, Aadhaar, ref code..."
        searchKeys={["name", "phone", "email", "pan", "aadhaar", "city"]}
        exportFilename="vgg-customers"
        pageSize={10}
        onRowClick={(c) => setViewId(c.id)}
        rightToolbar={
          <Button
            variant={showAllCustomers ? "default" : "outline"}
            size="sm"
            className="h-9 text-xs"
            onClick={() => setShowAllCustomers((v) => !v)}
          >
            {showAllCustomers ? "Showing All" : `Show All (${customers.length})`}
          </Button>
        }
      />

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o && prefillCustomer) clearPrefill(); }}>
        <DialogContent className="sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Customer" : prefillCustomer ? "Add New Buyer" : "Add New Customer"}</DialogTitle>
            <DialogDescription>
              {prefillCustomer
                ? "After selecting or creating a customer, the booking form will open automatically with plot details prefilled."
                : "Capture complete buyer information. Documents can be attached via the Remarks/Notes field for now."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
            {/* Add Buyer mode toggle: Create New vs Choose Existing */}
            {prefillCustomer && !editingId && (
              <div className="flex gap-2 mb-4 p-1 bg-muted rounded-lg">
                <button
                  type="button"
                  onClick={() => setBuyerMode("new")}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium ${buyerMode === "new" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  Create New Customer
                </button>
                <button
                  type="button"
                  onClick={() => setBuyerMode("existing")}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium ${buyerMode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  Choose Existing Customer
                </button>
              </div>
            )}

            {/* Choose Existing Customer path */}
            {prefillCustomer && !editingId && buyerMode === "existing" ? (
              <div className="space-y-3">
                <Label className="text-xs">Select Existing Customer</Label>
                <Select value={existingCustomerId} onValueChange={setExistingCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {customers.length === 0 && (
                  <div className="text-xs text-muted-foreground">No customers exist yet. Switch to “Create New Customer”.</div>
                )}
                <div className="text-xs text-muted-foreground">
                  The selected customer will be linked to the plot in the booking form that opens next.
                </div>
              </div>
            ) : (
              <>
            {/* Photo */}
            <div className="flex items-center gap-3">
              <Avatar className="w-16 h-16">
                {form.photo ? (
                  <img src={form.photo} alt="preview" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <AvatarFallback className="bg-primary/15 text-primary">
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Upload Photo
                </Button>
                {form.photo && (
                  <Button type="button" variant="ghost" size="sm" className="ml-2 text-rose-600" onClick={() => setForm((f) => ({ ...f, photo: "" }))}>
                    Remove
                  </Button>
                )}
                <div className="text-[11px] text-muted-foreground mt-1">Max 1MB · JPG/PNG</div>
              </div>
            </div>

            {/* Names */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <Label className="text-xs">Full Name *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Father&apos;s Name</Label>
                <Input value={form.fatherName} onChange={(e) => setForm((f) => ({ ...f, fatherName: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Mother&apos;s Name</Label>
                <Input value={form.motherName} onChange={(e) => setForm((f) => ({ ...f, motherName: e.target.value }))} />
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Phone *</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+91..." />
              </div>
              <div>
                <Label className="text-xs">Alternate Phone</Label>
                <Input value={form.alternatePhone} onChange={(e) => setForm((f) => ({ ...f, alternatePhone: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Address</Label>
                <Textarea rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">City</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">State</Label>
                <Input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">PIN Code</Label>
                <Input value={form.pinCode} onChange={(e) => setForm((f) => ({ ...f, pinCode: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Occupation</Label>
                <Input value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} />
              </div>
            </div>

            {/* KYC */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">PAN</Label>
                <Input value={form.pan} onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" />
              </div>
              <div>
                <Label className="text-xs">Aadhaar</Label>
                <Input value={form.aadhaar} onChange={(e) => setForm((f) => ({ ...f, aadhaar: e.target.value }))} placeholder="XXXX-XXXX-XXXX" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Remarks</Label>
              <Textarea rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleDialogCancel}>Cancel</Button>
            {prefillCustomer && !editingId && buyerMode === "existing" ? (
              <Button onClick={handleNextExisting} className="bg-primary">Next</Button>
            ) : prefillCustomer && !editingId ? (
              <Button onClick={handleSave} className="bg-primary">Next</Button>
            ) : (
              <Button onClick={handleSave} className="bg-primary">
                {editingId ? "Save Changes" : "Add Customer"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Customer Profile</DialogTitle>
          </DialogHeader>
          {viewCustomer && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="flex items-start gap-3">
                <Avatar className="w-16 h-16">
                  {viewCustomer.photo ? (
                    <img src={viewCustomer.photo} alt={viewCustomer.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback className="bg-primary/15 text-primary">
                      {viewCustomer.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <div className="font-semibold text-lg">{viewCustomer.name}</div>
                  <div className="text-sm text-muted-foreground">{viewCustomer.occupation}</div>
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    Added {formatDate(viewCustomer.createdAt)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow icon={Phone} label="Phone" value={viewCustomer.phone} />
                {viewCustomer.alternatePhone && <InfoRow icon={Phone} label="Alt Phone" value={viewCustomer.alternatePhone} />}
                {viewCustomer.email && <InfoRow icon={Mail} label="Email" value={viewCustomer.email} />}
                {viewCustomer.pan && <InfoRow icon={IdCard} label="PAN" value={viewCustomer.pan} />}
                {viewCustomer.aadhaar && <InfoRow icon={IdCard} label="Aadhaar" value={viewCustomer.aadhaar} />}
                {viewCustomer.occupation && <InfoRow icon={Briefcase} label="Occupation" value={viewCustomer.occupation} />}
                {viewCustomer.fatherName && <InfoRow icon={User} label="Father" value={viewCustomer.fatherName} />}
                {viewCustomer.motherName && <InfoRow icon={User} label="Mother" value={viewCustomer.motherName} />}
              </div>

              {viewCustomer.address && (
                <div className="text-sm flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    {viewCustomer.address}
                    {(viewCustomer.city || viewCustomer.state || viewCustomer.pinCode) && (
                      <div className="text-muted-foreground">
                        {[viewCustomer.city, viewCustomer.state, viewCustomer.pinCode].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {viewCustomer.remarks && (
                <div className="text-sm p-2.5 rounded-md bg-muted/50">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">Remarks</div>
                  {viewCustomer.remarks}
                </div>
              )}

              {/* Owned plots */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Building className="w-4 h-4 text-primary" />
                  <div className="text-sm font-semibold">Owned Plots ({customerPlots(viewCustomer.id).length})</div>
                </div>
                <div className="space-y-1">
                  {customerPlots(viewCustomer.id).length === 0 ? (
                    <div className="text-xs text-muted-foreground p-2 border border-dashed rounded-md text-center">
                      No plots owned yet
                    </div>
                  ) : (
                    customerPlots(viewCustomer.id).map((p) => {
                      const b = bookings.find((b) => b.id === p.bookingId);
                      const s = sales.find((s) => s.id === p.saleId);
                      return (
                        <div key={p.id} className="p-2 rounded-md border border-border text-sm">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium">Plot {p.plotNumber}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{p.block} · {p.size} {p.sizeUnit} · {p.facing}</span>
                            </div>
                            <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                          </div>
                          {/* Reference code */}
                          {(b?.referenceCode || s?.referenceCode) && (
                            <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                              Ref: {b?.referenceCode ?? s?.referenceCode}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Payment history by date */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  <div className="text-sm font-semibold">
                    Payment History ({payments.filter((p) => p.customerId === viewCustomer.id).length} payments)
                  </div>
                </div>
                {(() => {
                  const custPayments = payments
                    .filter((p) => p.customerId === viewCustomer.id)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  const totalPaid = custPayments.reduce((sum, p) => sum + p.amount, 0);
                  if (custPayments.length === 0) {
                    return (
                      <div className="text-xs text-muted-foreground p-2 border border-dashed rounded-md text-center">
                        No payments recorded yet
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1">
                      {/* Total summary */}
                      <div className="p-2 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                        <span className="text-xs font-medium text-emerald-800">Total Paid</span>
                        <span className="text-sm font-bold text-emerald-700">{inr(totalPaid)}</span>
                      </div>
                      {/* Payment list by date (newest first) */}
                      {custPayments.map((p, idx) => {
                        const plot = plots.find((pl) => pl.id === p.plotId);
                        return (
                          <div key={p.id} className="flex items-center justify-between p-2 rounded-md border border-border text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/10 text-primary grid place-items-center text-[9px] font-bold shrink-0">
                                {custPayments.length - idx}
                              </div>
                              <div>
                                <div className="font-medium">{formatDate(p.date)}</div>
                                <div className="text-muted-foreground">
                                  {plot ? `Plot ${plot.plotNumber} · Block ${plot.block}` : p.remarks || "Payment"}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {p.paymentMode.toUpperCase()}
                                  {p.referenceNumber ? ` · Ref ${p.referenceNumber}` : ""}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-emerald-700">{inr(p.amount)}</div>
                              {p.remarks && <div className="text-[9px] text-muted-foreground max-w-[120px] truncate">{p.remarks}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewId(null)}>Close</Button>
            {viewCustomer && permissions?.canEditCustomers !== false && (
              <Button onClick={() => { openEdit(viewCustomer); setViewId(null); }} className="bg-primary">
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              The customer record will be removed. Linked plots will become available again.
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

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
        <div>{value}</div>
      </div>
    </div>
  );
}


