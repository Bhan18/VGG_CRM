
"use client";

// ============================================================
// EMI Calculator (Simple-Interest Amortization, simple props)
// ------------------------------------------------------------
// Monthly EMI is DERIVED from the pending amount, annual rate, and
// tenure using SIMPLE INTEREST amortization:
//
//   pendingAmount     = totalAmount − paidAmount
//   years             = tenureMonths / 12
//   totalInterest     = pendingAmount × (annualRate/100) × years
//   totalWithInterest = pendingAmount + totalInterest
//   rawEMI            = totalWithInterest / tenureMonths
//   monthlyEMI        = round to nearest ₹100 of rawEMI
//   totalPayable      = monthlyEMI × tenureMonths
//
// Example: pending ₹50,000, annualRate 24%, tenure 12 months
//   years             = 1
//   totalInterest     = 50,000 × 0.24 × 1 = ₹12,000
//   totalWithInterest = ₹62,000
//   rawEMI            = 62,000 / 12 = ₹5,166.67
//   monthlyEMI        = ₹5,200  (rounded to nearest ₹100)
//
// So the EMI INCLUDES both principal and interest — it is NOT just
// the monthly interest charge. The schedule debits ₹5,200 every
// month for 12 months, paying off ₹62,400 in total (₹50,000
// principal + ₹12,000 interest + ₹400 rounding adjustment).
//
// Props (simple):
//   - open, onOpenChange  (dialog state)
//   - plot                (used for plot.totalPrice + plot details)
//   - customer            (shown in header / print)
//   - projectName         (shown in header / print)
//   - company             (used in print header)
//   - initialPaidAmount?  (optional: pre-fill Paid from payment history)
//
// Inputs (editable):
//   - Total Amount  (pre-filled from plot.totalPrice)
//   - Paid Amount   (pre-filled from initialPaidAmount prop or 0)
//   - Annual Rate   (e.g. 24 → simple interest over the tenure)
//   - Tenure        (e.g. 60 months)
//
// Pending Amount = Total − Paid (read-only display + drives EMI calc).
// Split bar: Pending (blue, principal) vs Total Interest (yellow).
// Schedule preview: Month / EMI / Balance only.
// Print document: no annual rate, no Interest/Principal columns.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Printer,
  IndianRupee,
  Percent,
  Calendar,
  X,
  Wallet,
} from "lucide-react";
import {
  calculateEMI,
  inr,
  inrCompact,
  printEMISchedule,
  type EMIInput,
  type EMIResult,
} from "@/lib/format";
import type {
  CompanySettings,
  Customer,
  Plot,
} from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Plot — used to pre-fill total amount and to print plot details. */
  plot?: Plot;
  customer?: Customer;
  projectName?: string;
  company: CompanySettings;
  /** Optional: pre-fill Paid Amount from payment history. */
  initialPaidAmount?: number;
}

const TENURE_PRESETS = [12, 24, 36, 60, 84, 120, 180, 240];
const RATE_PRESETS = [0, 8.5, 9.5, 10.5, 12, 18, 24];

export function EMICalculator({
  open,
  onOpenChange,
  plot,
  customer,
  projectName,
  company,
  initialPaidAmount,
}: Props) {
  // Total Amount: pre-filled from plot.totalPrice. No hard-coded placeholder.
  const [totalAmount, setTotalAmount] = useState<number>(plot?.totalPrice ?? 0);
  // Paid Amount: pre-filled from prop (payment history) or 0.
  const [paidAmount, setPaidAmount] = useState<number>(initialPaidAmount ?? 0);
  const [annualRate, setAnnualRate] = useState<number>(24);
  const [tenureMonths, setTenureMonths] = useState<number>(60);

  // Re-sync when the dialog opens or plot/initialPaidAmount changes.
  useEffect(() => {
    if (open && plot?.totalPrice !== undefined) {
      setTotalAmount(plot.totalPrice);
    }
  }, [open, plot?.totalPrice]);

  useEffect(() => {
    if (open && typeof initialPaidAmount === "number") {
      setPaidAmount(initialPaidAmount);
    }
  }, [open, initialPaidAmount]);

  const input: EMIInput = useMemo(
    () => ({ totalAmount, paidAmount, annualRate, tenureMonths }),
    [totalAmount, paidAmount, annualRate, tenureMonths],
  );
  const result: EMIResult = useMemo(() => calculateEMI(input), [input]);

  const handlePrint = () => {
    printEMISchedule({ input, result, company, plot, projectName, customer });
  };

  // Pending Amount = Total − Paid (also exposed as result.pendingAmount).
  const pendingAmount = result.pendingAmount;

  // Split bar: Pending Amount (blue, base principal) vs Total Interest (yellow).
  // Use totalPayable as the denominator so percentages reflect what's
  // actually being paid (after EMI rounding).
  const totalInterest = result.totalInterest;
  const splitTotal = result.totalPayable;
  const basePct =
    splitTotal > 0 ? Math.min(100, (pendingAmount / splitTotal) * 100) : 0;
  const extraPct = Math.max(0, 100 - basePct);

  // Live calc helper string — mirrors the formula in calculateEMI.
  // This proves the EMI is (principal + interest) ÷ tenure, NOT just
  // the monthly interest charge.
  //   totalInterest     = pending × (annualRate/100) × years
  //   totalWithInterest = pending + totalInterest   ← principal + interest
  //   monthlyEMI        = round to nearest 100 of (totalWithInterest / tenureMonths)
  const years = tenureMonths / 12;
  const liveTotalInterest = pendingAmount * (annualRate / 100) * years;
  const liveTotalWithInterest = pendingAmount + liveTotalInterest;
  const liveRawEMI = liveTotalWithInterest / tenureMonths;
  const liveEMI = Math.round(liveRawEMI / 100) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            EMI Calculator
          </DialogTitle>
          <DialogDescription>
            Calculate monthly installment for a plot purchase.{" "}
            {plot ? `Plot ${plot.plotNumber}` : ""}
            {customer ? ` · ${customer.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {/* ---------- Pending Amount banner (read-only) ---------- */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex justify-between items-center">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">
              Pending Amount (Total − Paid)
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-0.5">
              {inr(pendingAmount)}
            </div>
          </div>
          <div className="text-right text-xs text-amber-800">
            <div>
              Total: <strong>{inr(totalAmount)}</strong>
            </div>
            <div>
              Paid: <strong>{inr(paidAmount)}</strong>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* ---------- Inputs ---------- */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <IndianRupee className="w-3.5 h-3.5" /> Total Amount
              </Label>
              <NumberInput
                value={totalAmount}
                onValueChange={setTotalAmount}
                min={0}
                step={10000}
                allowDecimal={false}
                className="text-base font-semibold"
              />
              <p className="text-[11px] text-muted-foreground">
                {inrCompact(totalAmount)}
                {plot?.totalPrice !== undefined &&
                  totalAmount !== plot.totalPrice && (
                    <span className="ml-2 text-amber-600">
                      (edited — plot price: {inr(plot.totalPrice)})
                    </span>
                  )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Wallet className="w-3.5 h-3.5" /> Paid Amount
              </Label>
              <NumberInput
                value={paidAmount}
                onValueChange={setPaidAmount}
                min={0}
                max={totalAmount}
                step={5000}
                allowDecimal={false}
                className="text-base font-semibold"
              />
              <p className="text-[11px] text-muted-foreground">
                Amount already paid (advance / down payment).
                {typeof initialPaidAmount === "number" &&
                  paidAmount !== initialPaidAmount && (
                    <span className="ml-2 text-amber-600">
                      (edited — from history: {inr(initialPaidAmount)})
                    </span>
                  )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Percent className="w-3.5 h-3.5" /> Annual Rate (%)
              </Label>
              <NumberInput
                value={annualRate}
                onValueChange={setAnnualRate}
                min={0}
                max={36}
                step={0.25}
                allowDecimal
                className="text-base font-semibold"
              />
              <p className="text-[11px] text-muted-foreground">
                <span className="text-primary font-semibold">
                  Principal + Extra Amount
                </span>
              
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {RATE_PRESETS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setAnnualRate(r)}
                    className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                      annualRate === r
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border"
                    }`}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5" /> Tenure (months)
              </Label>
              <NumberInput
                value={tenureMonths}
                onValueChange={(v) => setTenureMonths(Math.max(1, Math.round(v)))}
                min={1}
                max={360}
                step={1}
                className="text-base font-semibold"
              />
              <p className="text-[11px] text-muted-foreground">
                {tenureMonths} months ({(tenureMonths / 12).toFixed(1)} years)
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {TENURE_PRESETS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTenureMonths(t)}
                    className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                      tenureMonths === t
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-accent border-border"
                    }`}
                  >
                    {t}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ---------- Results ---------- */}
          <div className="space-y-3">
            <div className="rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Monthly EMI <span className="text-primary">(Principal + Extra Amount)</span>
              </div>
              <div className="text-3xl font-bold text-primary mt-1">
                {inr(result.monthlyEMI)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                for {tenureMonths} months ({(tenureMonths / 12).toFixed(1)} years)
              </div>
              <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-primary/10">
                = ({inr(pendingAmount)} principal + {inr(totalInterest)} interest) ÷ {tenureMonths} mo, rounded to ₹100
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-[10px] uppercase text-muted-foreground">
                  Pending Amount
                </div>
                <div className="text-sm font-semibold mt-0.5">
                  {inr(pendingAmount)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {basePct.toFixed(1)}% of payable
                </div>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="text-[10px] uppercase text-muted-foreground">
                  Total Extra Amount
                </div>
                <div className="text-sm font-semibold mt-0.5">
                  {inr(totalInterest)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {extraPct.toFixed(1)}% of payable
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex justify-between items-center">
                <div className="text-xs text-muted-foreground">
                  Total Payable via EMI
                </div>
                <div className="text-base font-bold">
                  {inr(result.totalPayable)}
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full overflow-hidden bg-secondary flex">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${basePct}%` }}
                  title="Pending Amount"
                />
                <div
                  className="bg-amber-500 h-full transition-all duration-300"
                  style={{ width: `${extraPct}%` }}
                  title="Extra Amount"
                />
              </div>
              <div className="flex justify-between text-[10px] mt-1">
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1.5 py-0"
                >
                  Pending ({basePct.toFixed(1)}%)
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] h-4 px-1.5 py-0 bg-amber-50"
                >
                  Extra Amount ({extraPct.toFixed(1)}%)
                </Badge>
              </div>
            </div>

            <Button
              onClick={handlePrint}
              variant="outline"
              className="w-full"
              disabled={result.schedule.length === 0}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print EMI Schedule
            </Button>
          </div>
        </div>

        {/* ---------- Schedule preview ---------- */}
        {result.schedule.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Schedule Preview · First 6 Months
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Month
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      EMI
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.schedule.slice(0, 6).map((s) => (
                    <tr key={s.month} className="border-t">
                      <td className="px-3 py-2">{s.month}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {inr(s.emi)}
                      </td>
                      <td className="px-3 py-2 text-right">{inr(s.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EMICalculator;


