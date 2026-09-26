"use client";

// Admin Settings — attendance rules, permitted locations, own password.
// Backed by /api/attendance/admin/settings.

import { useEffect, useState } from "react";
import {
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  Check,
  Settings as SettingsIcon,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAgentAuth } from "@/hooks/agent/use-agent-auth";
import { useAdminFetch } from "@/hooks/admin/use-admin-data";
import {
  SkeletonList,
  ErrorState,
} from "@/components/agent/ui-primitives";
import { ConfirmSheet } from "./employees-tab";

type Rules = {
  id: string;
  office_start_time: string;
  office_end_time: string;
  check_in_early_window_minutes: number;
  check_out_early_window_minutes: number;
  reason_options: string[];
  late_after_minutes: number;
  half_day_after_minutes: number;
  minimum_working_minutes: number;
  require_photo: boolean;
  require_location: boolean;
  timezone: string;
};

type OfficeLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowed_radius: number;
  status: "ACTIVE" | "INACTIVE";
};

type SettingsData = {
  settings: Rules;
  locations: OfficeLocation[];
};

const inputCls =
  "w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)]";

export function SettingsTab() {
  const { data, loading, error, reload } = useAdminFetch<SettingsData>(
    "/api/attendance/admin/settings",
  );

  if (loading && !data) return <SkeletonList count={4} height={120} />;
  if (error && !data) {
    return <ErrorState title="Couldn't load settings" description={error} onRetry={reload} />;
  }
  if (!data) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <RulesForm initial={data.settings} onSaved={reload} />
      <LocationsSection locations={data.locations} onChanged={reload} />
      <PasswordCard />
    </div>
  );
}

// ─── Attendance rules ────────────────────────────────────────────────────

function RulesForm({ initial, onSaved }: { initial: Rules; onSaved: () => void }) {
  const [start, setStart] = useState(initial.office_start_time);
  const [end, setEnd] = useState(initial.office_end_time);
  const [checkInEarly, setCheckInEarly] = useState(String(initial.check_in_early_window_minutes));
  const [checkOutEarly, setCheckOutEarly] = useState(String(initial.check_out_early_window_minutes));
  const [lateAfter, setLateAfter] = useState(String(initial.late_after_minutes));
  const [halfDayAfter, setHalfDayAfter] = useState(String(initial.half_day_after_minutes));
  const [minWork, setMinWork] = useState(String(initial.minimum_working_minutes));
  const [requirePhoto, setRequirePhoto] = useState(initial.require_photo);
  const [requireLocation, setRequireLocation] = useState(initial.require_location);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [reasons, setReasons] = useState(initial.reason_options.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh the form when fresh data arrives.
  useEffect(() => {
    setStart(initial.office_start_time);
    setEnd(initial.office_end_time);
    setCheckInEarly(String(initial.check_in_early_window_minutes));
    setCheckOutEarly(String(initial.check_out_early_window_minutes));
    setLateAfter(String(initial.late_after_minutes));
    setHalfDayAfter(String(initial.half_day_after_minutes));
    setMinWork(String(initial.minimum_working_minutes));
    setRequirePhoto(initial.require_photo);
    setRequireLocation(initial.require_location);
    setTimezone(initial.timezone);
    setReasons(initial.reason_options.join(", "));
  }, [initial]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const reasonOptions = reasons.split(",").map((r) => r.trim()).filter(Boolean);
    if (reasonOptions.length === 0) {
      setError("At least one reason option is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          settings: {
            officeStartTime: start,
            officeEndTime: end,
            checkInEarlyWindowMinutes: Number(checkInEarly),
            checkOutEarlyWindowMinutes: Number(checkOutEarly),
            lateAfterMinutes: Number(lateAfter),
            halfDayAfterMinutes: Number(halfDayAfter),
            minimumWorkingMinutes: Number(minWork),
            requirePhoto,
            requireLocation,
            timezone: timezone.trim() || "Asia/Kolkata",
            reasonOptions,
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.error ?? "Could not save rules.");
        return;
      }
      toast.success("Attendance rules saved");
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="agent-card p-4">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
        <div className="text-sm font-semibold">Attendance rules</div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Office start"><input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} /></Field>
        <Field label="Office end"><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} /></Field>
        <Field label="Check-in early window (min)"><input type="number" min="0" value={checkInEarly} onChange={(e) => setCheckInEarly(e.target.value)} className={inputCls} /></Field>
        <Field label="Check-out early window (min)"><input type="number" min="0" value={checkOutEarly} onChange={(e) => setCheckOutEarly(e.target.value)} className={inputCls} /></Field>
        <Field label="Late after (min)"><input type="number" min="0" value={lateAfter} onChange={(e) => setLateAfter(e.target.value)} className={inputCls} /></Field>
        <Field label="Half-day after (min worked)"><input type="number" min="0" value={halfDayAfter} onChange={(e) => setHalfDayAfter(e.target.value)} className={inputCls} /></Field>
        <Field label="Full day needs (min worked)"><input type="number" min="0" value={minWork} onChange={(e) => setMinWork(e.target.value)} className={inputCls} /></Field>
        <Field label="Timezone"><input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kolkata" className={inputCls} /></Field>
      </div>

      <div className="mt-3">
        <Field label="Early check-in/out reasons (comma separated)">
          <input value={reasons} onChange={(e) => setReasons(e.target.value)} placeholder="Traffic, Emergency, ..." className={inputCls} />
        </Field>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        <Toggle label="Photo required for check-in/out" value={requirePhoto} onChange={setRequirePhoto} />
        <Toggle label="Location check required" value={requireLocation} onChange={setRequireLocation} />
      </div>

      {error && (
        <div className="mt-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="agent-press mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--brand-emerald)" }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {busy ? "Saving..." : "Save rules"}
      </button>
    </form>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-xs font-medium" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 15%, #e5e0d4)" }}>
      {label}
      <span
        onClick={(e) => { e.preventDefault(); onChange(!value); }}
        className="relative h-6 w-11 rounded-full transition-colors"
        style={{ background: value ? "var(--brand-emerald)" : "#d8d4c8" }}
        role="switch"
        aria-checked={value}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ left: value ? "22px" : "2px" }}
        />
      </span>
    </label>
  );
}

// ─── Locations ───────────────────────────────────────────────────────────

function LocationsSection({ locations, onChanged }: { locations: OfficeLocation[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<OfficeLocation | null>(null);
  const [deleting, setDeleting] = useState<OfficeLocation | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggleStatus(l: OfficeLocation) {
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "update-location",
          id: l.id,
          status: l.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Could not update location.");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "delete-location", id: deleting.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error ?? "Could not delete location.");
        return;
      }
      toast.success("Location deleted");
      setDeleting(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
          <div className="text-sm font-semibold">Office locations</div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="agent-press flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white"
          style={{ background: "var(--brand-emerald)" }}
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed px-4 py-8 text-center text-xs text-[var(--brand-ink)]/40" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 12%, #e5e0d4)" }}>
          No locations. Add your office to enable GPS check-in.
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {locations.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "color-mix(in srgb, var(--brand-emerald) 10%, #e5e0d4)" }}>
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: l.status === "ACTIVE" ? "color-mix(in srgb, var(--brand-emerald) 10%, white)" : "rgba(0,0,0,0.05)",
                  color: l.status === "ACTIVE" ? "var(--brand-emerald)" : "rgba(0,0,0,0.4)",
                }}
              >
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-semibold">{l.name}</span>
                  {l.status !== "ACTIVE" && (
                    <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-black/50">Off</span>
                  )}
                </div>
                <div className="text-[10px] tabular-nums text-[var(--brand-ink)]/50">
                  {l.latitude.toFixed(4)}, {l.longitude.toFixed(4)} · {l.allowed_radius}m radius
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  onClick={() => setEditing(l)}
                  title="Edit location"
                  className="agent-press flex h-7 w-7 items-center justify-center rounded-lg bg-black/5 text-black/60"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void toggleStatus(l)}
                  disabled={busy}
                  title={l.status === "ACTIVE" ? "Disable" : "Enable"}
                  className="agent-press rounded-lg px-2 py-1.5 text-[10px] font-semibold disabled:opacity-50"
                  style={{ background: "color-mix(in srgb, var(--brand-gold) 12%, white)", color: "#8a6d24" }}
                >
                  {l.status === "ACTIVE" ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => setDeleting(l)}
                  title="Delete location"
                  className="agent-press flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showForm || editing) && (
        <LocationForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); onChanged(); }}
        />
      )}
      {deleting && (
        <ConfirmSheet
          title="Delete location?"
          body={`Delete "${deleting.name}"? Staff will no longer be able to check in there.`}
          confirmLabel="Delete"
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

function LocationForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: OfficeLocation | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [lat, setLat] = useState(initial ? String(initial.latitude) : "");
  const [lng, setLng] = useState(initial ? String(initial.longitude) : "");
  const [radius, setRadius] = useState(initial ? String(initial.allowed_radius) : "200");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          initial
            ? { action: "update-location", id: initial.id, name: name.trim(), latitude: Number(lat), longitude: Number(lng), allowedRadius: Number(radius) }
            : { action: "add-location", name: name.trim(), latitude: Number(lat), longitude: Number(lng), allowedRadius: Number(radius) || 200 },
        ),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.error ?? "Could not save location.");
        return;
      }
      toast.success(initial ? "Location updated" : "Location added");
      onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{initial ? "Edit location" : "Add location"}</div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VGG Infra Office" className={inputCls} />
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Latitude *"><input value={lat} onChange={(e) => setLat(e.target.value)} type="number" step="any" placeholder="17.3850" className={inputCls} /></Field>
          <Field label="Longitude *"><input value={lng} onChange={(e) => setLng(e.target.value)} type="number" step="any" placeholder="78.4867" className={inputCls} /></Field>
        </div>
        <div className="mt-3">
          <Field label="Allowed radius (meters)">
            <input value={radius} onChange={(e) => setRadius(e.target.value)} type="number" min="1" className={inputCls} />
          </Field>
        </div>
        <p className="mt-2 text-[10px] text-[var(--brand-ink)]/45">Tip: long-press your office on Google Maps to copy coordinates.</p>
        {error && (
          <div className="mt-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="agent-press mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--brand-emerald)" }}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Saving..." : initial ? "Save changes" : "Add location"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-[var(--brand-ink)]/70">{label}</label>
      {children}
    </div>
  );
}

// ─── Own password (unchanged) ────────────────────────────────────────────

function PasswordCard() {
  const { session } = useAgentAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p = session?.employee;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!current || !next) {
      setError("Enter your current and new password.");
      return;
    }
    if (next.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }
    if (next === current) {
      setError("New password must be different from the current password.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/staff/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not change password.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed", {
        description: "Use your new password next time you sign in.",
      });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[color-mix(in_srgb,var(--brand-emerald)_15%,#e5e0d4)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-emerald)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-emerald)_20%,transparent)]";

  return (
    <div className="agent-card p-5">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4" style={{ color: "var(--brand-emerald)" }} />
        <div className="text-sm font-semibold">Change your password</div>
      </div>
      <p className="mt-1 text-xs text-[var(--brand-ink)]/55">
        Signed in as {p?.name ?? "Admin"} ({p?.employeeCode ?? ""}). You will use the new password next time you sign in.
      </p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-pwd-current" className="text-xs font-medium text-[var(--brand-ink)]/70">
            Current password
          </label>
          <input
            id="admin-pwd-current"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={busy}
            className={inputClass}
            placeholder="Enter current password"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-pwd-new" className="text-xs font-medium text-[var(--brand-ink)]/70">
            New password
          </label>
          <div className="relative">
            <input
              id="admin-pwd-new"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              disabled={busy}
              className={`${inputClass} pr-10`}
              placeholder="At least 4 characters"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--brand-ink)]/45"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-pwd-confirm" className="text-xs font-medium text-[var(--brand-ink)]/70">
            Confirm new password
          </label>
          <input
            id="admin-pwd-confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
            className={inputClass}
            placeholder="Re-enter new password"
          />
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--brand-checkout) 8%, white)", color: "var(--brand-checkout)" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="agent-press flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--brand-emerald)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {busy ? "Saving..." : "Update password"}
        </button>
      </form>
    </div>
  );
}