
"use client";

import { useCrm } from "@/lib/store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { inr, inrCompact, statusColor, outstandingForPlot } from "@/lib/format";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, Legend, LineChart, Line, Area, AreaChart,
} from "recharts";
import { Building2, TrendingUp, Wallet, AlertTriangle } from "lucide-react";
import { useMemo } from "react";

export default function AnalyticsPage() {
  const { projects, plots, sales, payments, customers } = useCrm();

  // Status distribution
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    plots.forEach((p) => {
      counts[p.status] = (counts[p.status] ?? 0) + 1;
    });
    return (Object.keys(counts) as Array<keyof typeof statusColor>).map((k) => ({
      name: statusColor[k].label,
      value: counts[k],
      color: statusColor[k].hex,
    }));
  }, [plots]);

  // Revenue by project
  const revenueByProject = useMemo(() => {
    return projects
      .map((p) => {
        const projSales = sales.filter((s) => plots.find((pl) => pl.id === s.plotId)?.projectId === p.id);
        return {
          name: p.name.length > 24 ? p.name.slice(0, 22) + "…" : p.name,
          revenue: projSales.reduce((sum, s) => sum + s.saleAmount, 0),
          plots: plots.filter((pl) => pl.projectId === p.id).length,
          sold: plots.filter((pl) => pl.projectId === p.id && pl.status === "sold").length,
        };
      })
      .filter((x) => x.plots > 0);
  }, [projects, plots, sales]);

  // Monthly sales (last 12 months)
  const monthlySales = useMemo(() => {
    const months: { label: string; total: number; count: number; collected: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      const monthSales = sales.filter((s) => {
        const sd = new Date(s.saleDate);
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
      });
      const monthPays = payments.filter((p) => {
        const pd = new Date(p.date);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      });
      months.push({
        label,
        total: monthSales.reduce((sum, s) => sum + s.saleAmount, 0),
        count: monthSales.length,
        collected: monthPays.reduce((sum, p) => sum + p.amount, 0),
      });
    }
    return months;
  }, [sales, payments]);

  // Available vs Sold by project
  const availabilityByProject = useMemo(() => {
    return projects
      .map((p) => {
        const projPlots = plots.filter((pl) => pl.projectId === p.id);
        return {
          name: p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name,
          Available: projPlots.filter((pl) => pl.status === "available").length,
          Reserved: projPlots.filter((pl) => pl.status === "reserved" || pl.status === "booked").length,
          Sold: projPlots.filter((pl) => pl.status === "sold").length,
          Blocked: projPlots.filter((pl) => pl.status === "blocked").length,
        };
      })
      .filter((x) => x.Available + x.Reserved + x.Sold + x.Blocked > 0);
  }, [projects, plots]);

  // Outstanding payments by project
  const outstandingByProject = useMemo(() => {
    return projects
      .map((p) => {
        const projPlots = plots.filter((pl) => pl.projectId === p.id && (pl.status === "sold" || pl.status === "booked" || pl.status === "reserved"));
        const outstanding = projPlots.reduce((sum, pl) => sum + outstandingForPlot(pl, payments), 0);
        const collected = payments
          .filter((pay) => plots.find((pl) => pl.id === pay.plotId)?.projectId === p.id)
          .reduce((sum, pay) => sum + pay.amount, 0);
        return {
          name: p.name.length > 18 ? p.name.slice(0, 16) + "…" : p.name,
          Outstanding: outstanding,
          Collected: collected,
        };
      })
      .filter((x) => x.Outstanding + x.Collected > 0);
  }, [projects, plots, payments]);

  // Top customers by spend
  const topCustomers = useMemo(() => {
    return customers
      .map((c) => {
        const cSales = sales.filter((s) => s.customerId === c.id);
        return {
          name: c.name,
          spend: cSales.reduce((sum, s) => sum + s.saleAmount, 0),
          plots: plots.filter((p) => p.customerId === c.id).length,
        };
      })
      .filter((x) => x.spend > 0)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6);
  }, [customers, sales, plots]);

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Analytics"
        description="Visual insights across all projects — sales velocity, revenue, outstanding payments, and customer concentration."
      />

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 grid place-items-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">Total Sales Value</div>
            <div className="text-lg font-bold">{inrCompact(sales.reduce((s, x) => s + x.saleAmount, 0))}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 grid place-items-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">Revenue Collected</div>
            <div className="text-lg font-bold">{inrCompact(payments.reduce((s, p) => s + p.amount, 0))}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 grid place-items-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">Outstanding</div>
            <div className="text-lg font-bold">{inrCompact(plots.reduce((s, p) => s + outstandingForPlot(p, payments), 0))}</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase text-muted-foreground">Active Projects</div>
            <div className="text-lg font-bold">{projects.filter((p) => p.status === "active").length}</div>
          </div>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Plot Status Distribution */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Plot Status Distribution</div>
              <div className="text-xs text-muted-foreground">{plots.length} total plots</div>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                  {statusData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: number, n: string) => [`${v} plots`, n]} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-muted-foreground truncate">{s.name}</span>
                <span className="ml-auto font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Monthly Sales Trend */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Monthly Sales & Collections</div>
              <div className="text-xs text-muted-foreground">Last 12 months</div>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySales}>
                <defs>
                  <linearGradient id="salesGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={statusColor.sold.hex} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={statusColor.sold.hex} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={statusColor.available.hex} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={statusColor.available.hex} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => inrCompact(v).replace("₹", "")} />
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="total" name="Sales" stroke={statusColor.sold.hex} strokeWidth={2} fill="url(#salesGrad2)" />
                <Area type="monotone" dataKey="collected" name="Collected" stroke={statusColor.available.hex} strokeWidth={2} fill="url(#colGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Project */}
        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">Revenue by Project</div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByProject} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => inrCompact(v).replace("₹", "")} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" width={120} />
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Availability by Project */}
        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">Available vs Sold by Project</div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={availabilityByProject}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <RTooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Available" stackId="a" fill={statusColor.available.hex} />
                <Bar dataKey="Reserved" stackId="a" fill={statusColor.reserved.hex} />
                <Bar dataKey="Sold" stackId="a" fill={statusColor.sold.hex} />
                <Bar dataKey="Blocked" stackId="a" fill={statusColor.blocked.hex} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Outstanding by Project */}
        <Card className="p-5 lg:col-span-2">
          <div className="text-sm font-semibold mb-3">Outstanding Payments by Project</div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outstandingByProject}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" tickFormatter={(v) => inrCompact(v).replace("₹", "")} />
                <RTooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Collected" stackId="a" fill={statusColor.available.hex} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Outstanding" stackId="a" fill={statusColor.sold.hex} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top Customers */}
        <Card className="p-5">
          <div className="text-sm font-semibold mb-3">Top Customers by Spend</div>
          <div className="space-y-2">
            {topCustomers.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-6">No customer sales yet</div>
            ) : (
              topCustomers.map((c, idx) => (
                <div key={c.name} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/40 transition">
                  <div className={`w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold ${
                    idx === 0 ? "bg-amber-100 text-amber-700" :
                    idx === 1 ? "bg-slate-100 text-slate-700" :
                    idx === 2 ? "bg-orange-100 text-orange-700" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground">{c.plots} plot{c.plots !== 1 ? "s" : ""}</div>
                  </div>
                  <div className="text-sm font-semibold">{inrCompact(c.spend)}</div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}


