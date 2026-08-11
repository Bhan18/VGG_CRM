
"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  Project, Layout, Plot, Customer, Booking, Sale, Payment,
  CompanySettings, ActivityLog, User,
} from "@/lib/types";
import * as db from "@/lib/supabase-data";
import { useAuth } from "@/components/auth-provider";

interface DataState {
  projects: Project[];
  layouts: Layout[];
  plots: Plot[];
  customers: Customer[];
  bookings: Booking[];
  sales: Sale[];
  payments: Payment[];
  settings: CompanySettings | null;
  activityLogs: ActivityLog[];
  users: User[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSupabaseData(): DataState {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [
        p, l, pl, c, b, s, pay, sett, al, u,
      ] = await Promise.all([
        db.fetchProjects(),
        db.fetchLayouts(),
        db.fetchPlots(),
        db.fetchCustomers(),
        db.fetchBookings(),
        db.fetchSales(),
        db.fetchPayments(),
        db.fetchSettings().catch(() => null),
        db.fetchActivityLogs().catch(() => []),
        db.fetchUserProfiles().catch(() => []),
      ]);
      setProjects(p);
      setLayouts(l);
      setPlots(pl);
      setCustomers(c);
      setBookings(b);
      setSales(s);
      setPayments(pay);
      setSettings(sett);
      setActivityLogs(al);
      setUsers(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refresh();
    } else {
      // Reset data when user logs out
      setProjects([]); setLayouts([]); setPlots([]); setCustomers([]);
      setBookings([]); setSales([]); setPayments([]); setSettings(null);
      setActivityLogs([]); setUsers([]);
      setLoading(false);
    }
  }, [user, refresh]);

  return {
    projects, layouts, plots, customers, bookings, sales, payments,
    settings, activityLogs, users, loading, error, refresh,
  };
}


