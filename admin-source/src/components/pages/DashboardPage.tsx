
"use client";

import { useCrm } from "@/lib/store";
import { PageHeader } from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Building2,
  Map as MapIcon,
  Grid3x3,
  CircleDot,
  Lock,
  TrendingUp,
  Wallet,
  Banknote,
  IndianRupee,
  AlertTriangle,
  Calendar,
  Activity,
  ArrowRight,
  CircleCheck,
  Clock,
} from "lucide-react";
import { inr, inrCompact, formatDate, relativeTime, plotPayments, totalPaidForPlot, outstandingForPlot } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Legend, Area, AreaChart } from "recharts";
import { statusColor } from "@/lib/format";
import { useCrm as useStore } from "@/lib/store";

export default function DashboardPage() {
  const { projects, layouts, plots, customers, bookings, sales, payments, activityLogs, setRoute } = useCrm();

  const totalPlots = plots.length;
  const vacantPlots = plots.filter((p) => p.status === "available");
  const reservedPlots = plots.filter((p) => p.status === "reserved");
  const soldPlots = plots.filter((p) => p.status === "sold");
  const bookedPlots = plots.filter((p) => p.status === "booked");
  const blockedPlots = plots.filter((p) => p.status === "blocked");

  const totalSalesAmount = sales.reduce((s, x) => s + x.saleAmount, 0);
  const revenueCollected = payments.reduce((s, p) => s + p.amount, 0);
  const outstandingBalance = plots
    .filter((p) => p.status === "sold" || p.status === "booked" || p.status === "reserved")
    .reduce((sum, p) => sum + outstandingForPlot(p, payments), 0);
  const pendingPaymentsCount = plots.filter((p) => p.status === "sold" && outstandingForPlot(p, payments) > 0).length;

  // ===== Overdue Payments Alert =====
  // A plot is considered "overdue" when:
  //   - It has been sold/booked/reserved
  //   - There's still an outstanding balance
  //   - The booking/sale is older than 30 days
  // Sorted by oldest first (most overdue at top)
  const NOW = Date.now();
  const OVERDUE_THRESHOLD_MS = 30 * 86400000; // 30 days
  const overduePlots = plots
    .filter((p) => p.status === "sold" || p.status === "booked" || p.status === "reserved")
    .map((p) => {
      const outstanding = outstandingForPlot(p, payments, bookings, sales);
      if (outstanding <= 0) return null;
      const booking = bookings.find((b) => b.id === p.bookingId);
      const sale = sales.find((s) => s.id === p.saleId);
      // Use the EARLIER of booking date or sale date as the "starting" point
      const bookingTs = booking?.bookingDate ? new Date(booking.bookingDate).getTime() : null;
      const saleTs = sale?.saleDate ? new Date(sale.saleDate).getTime() : null;
      const startTs = bookingTs && saleTs ? Math.min(bookingTs, saleTs) : (bookingTs ?? saleTs);
      if (!startTs) return null;
      const ageMs = NOW - startTs;
      if (ageMs < OVERDUE_THRESHOLD_MS) return null;
      const cust = customers.find((c) => c.id === p.customerId);
      const proj = projects.find((pr) => pr.id === p.projectId);
      return {
        plot: p,
        customer: cust,
        projectName: proj?.name,
        outstanding,
        ageDays: Math.floor(ageMs / 86400000),
        startDate: bookingTs && saleTs ? new Date(Math.min(bookingTs, saleTs)).toISOString() : (bookingTs ? new Date(bookingTs).toISOString() : new Date(saleTs!).toISOString()),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.ageDays - a.ageDays);

  const totalOverdueAmount = overduePlots.reduce((sum, o) => sum + o.outstanding, 0);

  // Recent bookings (latest 5)
  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Recent sales (latest 5)
  const recentSales = [...sales]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Upcoming registrations (expected registration date in the future, or sale with future date)
  const upcomingRegistrations = [
    ...bookings
      .filter((b) => b.expectedRegistrationDate && new Date(b.expectedRegistrationDate) >= new Date())
      .map((b) => ({
        id: b.id,
        date: b.expectedRegistrationDate!,
        plotId: b.plotId,
        customerId: b.customerId,
        type: "booking",
      })),
  ]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  // Recent activity
  const recentActivity = activityLogs.slice(0, 6);

  // Plot status distribution chart
  const statusData = [
    { name: "Available", value: vacantPlots.length, color: statusColor.available.hex },
    { name: "Reserved", value: reservedPlots.length, color: statusColor.reserved.hex },
    { name: "Booked", value: bookedPlots.length, color: statusColor.booked.hex },
    { name: "Sold", value: soldPlots.length, color: statusColor.sold.hex },
    { name: "Blocked", value: blockedPlots.length, color: statusColor.blocked.hex },
  ].filter((d) => d.value > 0);

  // Monthly sales (last 6 months)
  const monthlySales = (() => {
    const months: { label: string; total: number; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString("en-IN", { month: "short" });
      const monthSales = sales.filter((s) => {
        const sd = new Date(s.saleDate);
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
      });
      months.push({
        label,
        total: monthSales.reduce((sum, s) => sum + s.saleAmount, 0),
        count: monthSales.length,
      });
    }
    return months;
  })();

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Dashboard Overview"
        description="Real-time snapshot of all VGG Infra Developers projects, plots, and financials."
      />

      {/* Row 1: Plot counts */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="view-enter stagger-1"><StatCard label="Total Projects" value={projects.length} icon={Building2} accent="primary" hint={`${layouts.length} layouts`} /></div>
        <div className="view-enter stagger-2"><StatCard label="Total Layouts" value={layouts.length} icon={MapIcon} accent="primary" hint="Across all projects" /></div>
        <div className="view-enter stagger-3"><StatCard label="Total Plots" value={totalPlots} icon={Grid3x3} accent="primary" hint="Across all layouts" /></div>
        <div className="view-enter stagger-4"><StatCard label="Vacant Plots" value={vacantPlots.length} icon={CircleDot} accent="emerald" hint="Available for sale" /></div>
        <div className="view-enter stagger-5"><StatCard label="Reserved Plots" value={reservedPlots.length + bookedPlots.length} icon={Lock} accent="sky" hint="Held for buyers" /></div>
      </div>

      {/* Row 2: Financials */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="view-enter stagger-1"><StatCard label="Sold Plots" value={soldPlots.length} icon={TrendingUp} accent="rose" hint={`${inrCompact(totalSalesAmount)} value`} /></div>
        <div className="view-enter stagger-2"><StatCard label="Total Sales" value={inrCompact(totalSalesAmount)} icon={IndianRupee} accent="rose" hint={`${sales.length} transactions`} /></div>
        <div className="view-enter stagger-3"><StatCard label="Pending Payments" value={pendingPaymentsCount} icon={AlertTriangle} accent="amber" hint={`${inrCompact(outstandingBalance)} outstanding`} /></div>
        <div className="view-enter stagger-4"><StatCard label="Revenue Collected" value={inrCompact(revenueCollected)} icon={Banknote} accent="emerald" hint={`${payments.length} receipts`} /></div>
        <div className="view-enter stagger-5"><StatCard label="Outstanding Balance" value={inrCompact(outstandingBalance)} icon={Wallet} accent="amber" hint="To be collected" /></div>
      </div>

      {/* Row 2.5: Overdue Payments Alert (only shown when there are overdue plots) */}
      {overduePlots.length > 0 && (
        <Card className="p-5 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500 text-white">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-amber-900">Overdue Payments Alert</div>
                <div className="text-xs text-amber-700">
                  {overduePlots.length} plot{overduePlots.length === 1 ? "" : "s"} with outstanding balance past 30 days · Total overdue: <strong>{inrCompact(totalOverdueAmount)}</strong>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-amber-400 text-amber-800 hover:bg-amber-100"
              onClick={() => setRoute("payments")}
            >
              Collect Payment <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto -mr-2 pr-2">
            {overduePlots.slice(0, 8).map((o) => (
              <button
                key={o.plot.id}
                onClick={() => setRoute("interactive-layout", { selectedPlotId: o.plot.id })}
                className="w-full text-left p-2.5 rounded-lg border border-amber-200 bg-white/60 hover:bg-white hover:border-amber-400 transition flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-amber-900">{o.plot.plotNumber}</span>
                    {o.projectName && <span className="text-[11px] text-amber-700 truncate">· {o.projectName}</span>}
                  </div>
                  <div className="text-xs text-amber-700 mt-0.5 truncate">
                    {o.customer?.name ?? "—"} · since {formatDate(o.startDate)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                    <Clock className="w-3 h-3 mr-0.5" />
                    {o.ageDays}d
                  </Badge>
                  <div className="text-right">
                    <div className="text-[10px] text-amber-600 uppercase">Outstanding</div>
                    <div className="text-sm font-bold text-amber-900">{inrCompact(o.outstanding)}</div>
                  </div>
                </div>
              </button>
            ))}
            {overduePlots.length > 8 && (
              <div className="text-center text-xs text-amber-700 pt-1.5">
                + {overduePlots.length - 8} more overdue plot{overduePlots.length - 8 === 1 ? "" : "s"} · click "Collect Payment" to view all
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Row 3: Charts + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status distribution */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Plot Status Distribution</div>
              <div className="text-xs text-muted-foreground">Across all layouts</div>
            </div>
            <Badge variant="outline" className="text-[10px]">{totalPlots} plots</Badge>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {statusData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <RTooltip
                  formatter={(v: number, n: string) => [`${v} plots`, n]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="ml-auto font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Monthly sales trend */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Monthly Sales Trend</div>
              <div className="text-xs text-muted-foreground">Last 6 months</div>
            </div>
            <Badge variant="outline" className="text-[10px]">{inrCompact(monthlySales.reduce((s, m) => s + m.total, 0))} total</Badge>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySales}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={statusColor.sold.hex} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={statusColor.sold.hex} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                  tickFormatter={(v) => inrCompact(v).replace("₹", "")}
                />
                <RTooltip
                  formatter={(v: number) => [inr(v), "Sales"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="total" stroke={statusColor.sold.hex} strokeWidth={2} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Row 4: Recent bookings + sales + registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Bookings */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Recent Bookings</div>
            <button
              onClick={() => setRoute("bookings")}
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto -mr-2 pr-2">
            {recentBookings.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">No bookings yet</div>
            ) : (
              recentBookings.map((b) => {
                const plot = plots.find((p) => p.id === b.plotId);
                const cust = customers.find((c) => c.id === b.customerId);
                return (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-lg border border-border hover:bg-muted/40 transition cursor-pointer"
                    onClick={() => setRoute("bookings")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{plot?.plotNumber ?? "—"}</div>
                      <StatusBadge status={plot?.status ?? "available"} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{cust?.name ?? "—"}</div>
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      <span className="text-muted-foreground">{formatDate(b.bookingDate)}</span>
                      <span className="font-semibold text-emerald-700">{inr(b.advancePaid)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Recent Sales */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Recent Sales</div>
            <button
              onClick={() => setRoute("sales")}
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto -mr-2 pr-2">
            {recentSales.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">No sales yet</div>
            ) : (
              recentSales.map((s) => {
                const plot = plots.find((p) => p.id === s.plotId);
                const cust = customers.find((c) => c.id === s.customerId);
                return (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-lg border border-border hover:bg-muted/40 transition cursor-pointer"
                    onClick={() => setRoute("sales")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{plot?.plotNumber ?? "—"}</div>
                      <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-transparent">
                        {s.registrationNumber}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{cust?.name ?? "—"}</div>
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      <span className="text-muted-foreground">{formatDate(s.saleDate)}</span>
                      <span className="font-semibold text-rose-700">{inr(s.saleAmount)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Upcoming Registrations */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Upcoming Registrations</div>
            <Badge variant="outline" className="text-[10px]">{upcomingRegistrations.length} scheduled</Badge>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto -mr-2 pr-2">
            {upcomingRegistrations.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">No upcoming registrations</div>
            ) : (
              upcomingRegistrations.map((r) => {
                const plot = plots.find((p) => p.id === r.plotId);
                const cust = customers.find((c) => c.id === r.customerId);
                const days = Math.ceil((new Date(r.date).getTime() - Date.now()) / 86400000);
                return (
                  <div
                    key={r.id}
                    className="p-2.5 rounded-lg border border-border hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{plot?.plotNumber ?? "—"}</div>
                      <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-transparent">
                        <Clock className="w-3 h-3 mr-0.5" />
                        {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days}d`}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{cust?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground mt-1">{formatDate(r.date)}</div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Row 5: Recent activity */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <div className="text-sm font-semibold">Recent Activity</div>
          </div>
          <button
            onClick={() => setRoute("settings")}
            className="text-[11px] text-primary hover:underline"
          >
            Audit log
          </button>
        </div>
        <div className="space-y-1">
          {recentActivity.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">No activity recorded yet</div>
          ) : (
            recentActivity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-b-0">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary grid place-items-center text-[10px] font-semibold shrink-0 mt-0.5">
                  {a.userName?.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium">{a.userName}</span>{" "}
                    <span className="text-muted-foreground">{a.details}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {relativeTime(a.timestamp)} · {a.action.replace(/_/g, " ").toLowerCase()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}


