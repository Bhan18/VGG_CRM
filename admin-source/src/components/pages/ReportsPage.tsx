
"use client";

import { useCrm } from "@/lib/store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileBarChart, FileText, FileSpreadsheet, Printer, Download,
  CircleCheck, Lock, TrendingUp, Users, IndianRupee, Wallet, AlertTriangle,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  inr, inrCompact, formatDate, statusColor,
  downloadCSV, downloadXLS, printHTML,
  outstandingForPlot, totalPaidForPlot, plotPayments,
} from "@/lib/format";
import type { PlotStatus } from "@/lib/types";

type ReportType =
  | "vacant"
  | "booked"
  | "reserved"
  | "sold"
  | "payment"
  | "customer"
  | "revenue"
  | "outstanding";

const reportDefs: {
  key: ReportType;
  title: string;
  description: string;
  icon: typeof FileBarChart;
  accent: string;
}[] = [
  { key: "vacant", title: "Vacant Plot Report", description: "All plots currently available for sale", icon: CircleCheck, accent: "bg-emerald-50 text-emerald-700" },
  { key: "booked", title: "Booked Plot Report", description: "Plots with confirmed bookings", icon: Lock, accent: "bg-amber-50 text-amber-700" },
  { key: "reserved", title: "Reserved Plot Report", description: "All reserved plots with booking details", icon: Lock, accent: "bg-sky-50 text-sky-700" },
  { key: "sold", title: "Sold Plot Report", description: "Completed sales with registration info", icon: TrendingUp, accent: "bg-rose-50 text-rose-700" },
  { key: "payment", title: "Payment Report", description: "Complete payment history with refs", icon: Wallet, accent: "bg-emerald-50 text-emerald-700" },
  { key: "customer", title: "Customer Report", description: "All customers with KYC and ownership", icon: Users, accent: "bg-primary/10 text-primary" },
  { key: "revenue", title: "Revenue Report", description: "Project-wise revenue collected", icon: IndianRupee, accent: "bg-emerald-50 text-emerald-700" },
  { key: "outstanding", title: "Outstanding Balance Report", description: "Pending dues across all sold/booked plots", icon: AlertTriangle, accent: "bg-amber-50 text-amber-700" },
];

export default function ReportsPage() {
  const { plots, projects, layouts, customers, bookings, sales, payments } = useCrm();
  const [selected, setSelected] = useState<ReportType>("vacant");
  const [filterProject, setFilterProject] = useState<string>("all");

  const report = reportDefs.find((r) => r.key === selected)!;

  const rows = useMemo(() => {
    const filtered = (arr: typeof plots) =>
      filterProject === "all" ? arr : arr.filter((p) => p.projectId === filterProject);

    switch (selected) {
      case "vacant":
        return filtered(plots.filter((p) => p.status === "available")).map((p) => {
          const proj = projects.find((x) => x.id === p.projectId);
          const layout = layouts.find((l) => l.id === p.layoutId);
          return {
            "Plot Number": p.plotNumber,
            "Project": proj?.name ?? "",
            "Layout": layout?.name ?? "",
            "Block": p.block,
            "Size (sqft)": p.size,
            "Facing": p.facing,
            "Corner Plot": p.cornerPlot ? "Yes" : "No",
            "Road Width (ft)": p.roadWidth,
            "Price per Cent": p.pricePerCent,
            "Total Price": p.totalPrice,
            "Status": "Available",
          };
        });
      case "reserved":
      case "booked":
        return filtered(plots.filter((p) => p.status === (selected === "reserved" ? "reserved" : "booked"))).map((p) => {
          const proj = projects.find((x) => x.id === p.projectId);
          const c = customers.find((x) => x.id === p.customerId);
          const b = bookings.find((x) => x.id === p.bookingId);
          return {
            "Plot Number": p.plotNumber,
            "Project": proj?.name ?? "",
            "Block": p.block,
            "Size (sqft)": p.size,
            "Total Price": p.totalPrice,
            "Customer": c?.name ?? "",
            "Customer Phone": c?.phone ?? "",
            "Booking Date": formatDate(b?.bookingDate),
            "Advance Paid": b?.advancePaid ?? 0,
            "Payment Method": b?.paymentMethod ?? "",
            "Expiry Date": formatDate(b?.bookingExpiry),
            "Status": statusColor[p.status].label,
          };
        });
      case "sold":
        return filtered(plots.filter((p) => p.status === "sold")).map((p) => {
          const proj = projects.find((x) => x.id === p.projectId);
          const c = customers.find((x) => x.id === p.customerId);
          const s = sales.find((x) => x.id === p.saleId);
          return {
            "Plot Number": p.plotNumber,
            "Project": proj?.name ?? "",
            "Block": p.block,
            "Size (sqft)": p.size,
            "Buyer": c?.name ?? "",
            "Buyer Phone": c?.phone ?? "",
            "Sale Date": formatDate(s?.saleDate),
            "Registration Number": s?.registrationNumber ?? "",
            "Sale Amount": s?.saleAmount ?? 0,
            "Discount": s?.discount ?? 0,
            "Balance Amount": s?.balanceAmount ?? 0,
            "Registration Office": s?.registrationOffice ?? "",
            "Executive": s?.executiveName ?? "",
          };
        });
      case "payment":
        return payments
          .filter((p) => {
            if (filterProject === "all") return true;
            const plot = plots.find((pl) => pl.id === p.plotId);
            return plot?.projectId === filterProject;
          })
          .map((p) => {
            const plot = plots.find((pl) => pl.id === p.plotId);
            const c = customers.find((c) => c.id === p.customerId);
            const proj = projects.find((x) => x.id === plot?.projectId);
            return {
              "Date": formatDate(p.date),
              "Plot": plot?.plotNumber ?? "",
              "Project": proj?.name ?? "",
              "Customer": c?.name ?? "",
              "Amount": p.amount,
              "Mode": p.paymentMode,
              "Reference #": p.referenceNumber ?? "",
              "Bank": p.bank ?? "",
              "Cheque #": p.chequeNumber ?? "",
              "Transaction ID": p.transactionId ?? "",
              "Remarks": p.remarks ?? "",
            };
          });
      case "customer":
        return customers.map((c) => {
          const cPlots = plots.filter((p) => p.customerId === c.id);
          return {
            "Name": c.name,
            "Phone": c.phone,
            "Email": c.email ?? "",
            "City": c.city ?? "",
            "State": c.state ?? "",
            "PAN": c.pan ?? "",
            "Aadhaar": c.aadhaar ?? "",
            "Occupation": c.occupation ?? "",
            "Plots Owned": cPlots.length,
            "Plot Numbers": cPlots.map((p) => p.plotNumber).join(", "),
            "Total Value": cPlots.reduce((sum, p) => sum + p.totalPrice, 0),
          };
        });
      case "revenue":
        return projects.map((p) => {
          const projPlots = plots.filter((pl) => pl.projectId === p.id);
          const projSales = sales.filter((s) => plots.find((pl) => pl.id === s.plotId)?.projectId === p.id);
          const projPayments = payments.filter((pay) => plots.find((pl) => pl.id === pay.plotId)?.projectId === p.id);
          return {
            "Project": p.name,
            "Location": p.location,
            "Total Plots": projPlots.length,
            "Sold": projPlots.filter((pl) => pl.status === "sold").length,
            "Available": projPlots.filter((pl) => pl.status === "available").length,
            "Total Sales Value": projSales.reduce((sum, s) => sum + s.saleAmount, 0),
            "Revenue Collected": projPayments.reduce((sum, pay) => sum + pay.amount, 0),
            "Outstanding": projPlots.reduce((sum, pl) => sum + outstandingForPlot(pl, payments), 0),
          };
        });
      case "outstanding":
        return filtered(plots.filter((p) => p.status === "sold" || p.status === "booked" || p.status === "reserved"))
          .map((p) => {
            const proj = projects.find((x) => x.id === p.projectId);
            const c = customers.find((x) => x.id === p.customerId);
            const paid = totalPaidForPlot(p, payments);
            const outstanding = outstandingForPlot(p, payments);
            return {
              "Plot Number": p.plotNumber,
              "Project": proj?.name ?? "",
              "Customer": c?.name ?? "",
              "Customer Phone": c?.phone ?? "",
              "Total Price": p.totalPrice,
              "Total Paid": paid,
              "Outstanding": outstanding,
              "Status": statusColor[p.status].label,
              "% Paid": p.totalPrice > 0 ? Math.round((paid / p.totalPrice) * 100) : 0,
            };
          })
          .filter((r) => (r as { Outstanding: number }).Outstanding > 0);
      default:
        return [];
    }
  }, [selected, filterProject, plots, projects, layouts, customers, bookings, sales, payments]);

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  const exportPDF = () => {
    const tableRows = rows
      .map(
        (r) =>
          "<tr>" +
          headers.map((h) => `<td>${(r as Record<string, unknown>)[h] == null ? "" : String((r as Record<string, unknown>)[h]).replace(/</g, "&lt;")}</td>`).join("") +
          "</tr>",
      )
      .join("");
    const tableHTML = `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table>`;
    printHTML(report.title, tableHTML);
  };

  return (
    <div className="view-enter space-y-5">
      <PageHeader
        title="Reports"
        description="Generate detailed reports across all CRM data. Export to Excel, CSV, or print to PDF."
      />

      {/* Report type selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reportDefs.map((r) => {
          const Icon = r.icon;
          const active = selected === r.key;
          return (
            <button
              key={r.key}
              onClick={() => setSelected(r.key)}
              className={`text-left p-3 rounded-xl border transition ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card border-border hover:bg-muted/40"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg grid place-items-center mb-2 ${active ? "bg-primary-foreground/15" : r.accent}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="font-semibold text-sm">{r.title}</div>
              <div className={`text-[11px] mt-0.5 ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {r.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* Report viewer */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg grid place-items-center ${report.accent}`}>
              <FileBarChart className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-sm">{report.title}</div>
              <div className="text-xs text-muted-foreground">{report.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selected !== "customer" && selected !== "revenue" && (
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
            )}
            <Button variant="outline" size="sm" className="h-9" onClick={() => downloadCSV(`${report.key}-report.csv`, rows)} disabled={rows.length === 0}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => downloadXLS(`${report.key}-report.xls`, rows)} disabled={rows.length === 0}>
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={exportPDF} disabled={rows.length === 0}>
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Print / PDF
            </Button>
          </div>
        </div>

        <div className="p-3 flex items-center justify-between text-xs text-muted-foreground bg-muted/30 border-b border-border">
          <div>
            <Badge variant="outline" className="text-[10px] mr-2">{rows.length} records</Badge>
            Generated on {new Date().toLocaleString("en-IN")}
          </div>
          <div className="flex items-center gap-1">
            <FileText className="w-3 h-3" /> VGG CRM Report
          </div>
        </div>

        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          {rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No data for this report.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="border-b border-border/60 hover:bg-muted/30">
                    {headers.map((h) => {
                      const v = (r as Record<string, unknown>)[h];
                      const isNum = typeof v === "number";
                      const isINR = isNum && ["Total Price", "Sale Amount", "Discount", "Balance Amount", "Advance Paid", "Amount", "Total Paid", "Outstanding", "Total Sales Value", "Revenue Collected", "Price per Cent", "Total Value"].includes(h);
                      return (
                        <td key={h} className={`px-3 py-2 whitespace-nowrap ${isNum ? "text-right" : ""}`}>
                          {isINR ? inr(v as number) : String(v ?? "")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}


