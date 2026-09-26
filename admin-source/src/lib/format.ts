
// ============================================================
// Format & derived selectors
// ============================================================

import type {
  Plot,
  PlotStatus,
  Customer,
  Booking,
  Sale,
  Payment,
  CompanySettings,
} from "./types";

// ============================================================
// Currency Formatting
// ============================================================

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export const inrCompact = (n: number) => {
  if (n >= 10000000) {
    return `₹${(n / 10000000).toFixed(2)} Cr`;
  }

  if (n >= 100000) {
    return `₹${(n / 100000).toFixed(2)} L`;
  }

  if (n >= 1000) {
    return `₹${(n / 1000).toFixed(1)} K`;
  }

  return `₹${n}`;
};

// ============================================================
// Date Formatting
// ============================================================

export const formatDate = (iso?: string) => {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (iso?: string) => {
  if (!iso) return "—";

  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const relativeTime = (iso?: string) => {
  if (!iso) return "";

  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);

  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);

  if (min < 60) {
    return `${min} min ago`;
  }

  const hr = Math.floor(min / 60);

  if (hr < 24) {
    return `${hr} hr ago`;
  }

  const day = Math.floor(hr / 24);

  if (day < 30) {
    return `${day} day${day === 1 ? "" : "s"} ago`;
  }

  return formatDate(iso);
};

// ============================================================
// Plot Status
// ============================================================

export const statusColor: Record<
  PlotStatus,
  {
    bg: string;
    text: string;
    dot: string;
    hex: string;
    label: string;
  }
> = {
  available: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    hex: "#10b981",
    label: "Available",
  },

  booked: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    hex: "#f59e0b",
    label: "Booked",
  },

  reserved: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    dot: "bg-sky-500",
    hex: "#0ea5e9",
    label: "Reserved",
  },

  sold: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    dot: "bg-rose-500",
    hex: "#f43f5e",
    label: "Sold",
  },

  blocked: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-500",
    hex: "#64748b",
    label: "Blocked",
  },
};

export const allStatuses: PlotStatus[] = [
  "available",
  "booked",
  "reserved",
  "sold",
  "blocked",
];

export const allFacings = [
  "North",
  "South",
  "East",
  "West",
  "North-East",
  "North-West",
  "South-East",
  "South-West",
] as const;

export const allPaymentModes = [
  "cash",
  "cheque",
  "neft",
  "rtgs",
  "upi",
  "card",
  "bank_transfer",
] as const;

// ============================================================
// Land Area
// ============================================================

// 1 Acre = 100 cents = 4840 sq yd
export function toAcres(
  size: number,
  unit: "cents" | "sqyd",
): number {
  if (!size || size <= 0) return 0;

  switch (unit) {
    case "cents":
      return size / 100;

    case "sqyd":
      return size / 4840;

    default:
      return 0;
  }
}

export function formatAcres(
  size: number,
  unit: "cents" | "sqyd",
): string {
  const acres = toAcres(size, unit);

  if (acres === 0) {
    return "0 Acres";
  }

  return `${acres.toFixed(3)} Acres`;
}

// ============================================================
// Derived Selectors
// ============================================================

export function plotCustomer(
  plot: Plot,
  customers: Customer[],
): Customer | undefined {
  return customers.find(
    (c) => c.id === plot.customerId,
  );
}

export function plotBooking(
  plot: Plot,
  bookings: Booking[],
): Booking | undefined {
  const booking = bookings.find(
    (b) => b.id === plot.bookingId,
  );

  return booking && booking.status !== "cancelled"
    ? booking
    : undefined;
}

export function plotSale(
  plot: Plot,
  sales: Sale[],
): Sale | undefined {
  return sales.find(
    (s) => s.id === plot.saleId,
  );
}

export function plotPayments(
  plot: Plot,
  payments: Payment[],
): Payment[] {
  return payments
    .filter((p) => p.plotId === plot.id)
    .sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime(),
    );
}

export function totalPaidForPlot(
  plot: Plot,
  payments: Payment[],
): number {
  return plotPayments(plot, payments).reduce(
    (sum, payment) =>
      sum + (payment.amount || 0),
    0,
  );
}

export function outstandingForPlot(
  plot: Plot,
  payments: Payment[],
  bookings?: Booking[],
  sales?: Sale[],
): number {
  let owed = plot.totalPrice;

  // Sale discount takes precedence
  if (sales) {
    const sale = sales.find(
      (s) => s.id === plot.saleId,
    );

    if (sale) {
      owed -= sale.discount;
    }
  }

  // Booking discount
  if (bookings && !plot.saleId) {
    const booking = bookings.find(
      (b) => b.id === plot.bookingId,
    );

    if (booking) {
      owed -= booking.discount ?? 0;
    }
  }

  owed = Math.max(0, owed);

  return Math.max(
    0,
    owed - totalPaidForPlot(plot, payments),
  );
}

// ============================================================
// Payment Status Threshold
// ============================================================

export const RESERVE_THRESHOLD = 50000;

export function shouldUpgradeToReserved(
  plot: Plot,
  payments: Payment[],
): boolean {
  if (plot.status !== "booked") {
    return false;
  }

  return (
    totalPaidForPlot(plot, payments) >=
    RESERVE_THRESHOLD
  );
}

export function computePlotStatusFromPayments(
  plot: Plot,
  payments: Payment[],
): Plot["status"] {
  if (plot.status === "sold") {
    return "sold";
  }

  if (plot.status === "blocked") {
    return "blocked";
  }

  if (plot.status === "available") {
    return "available";
  }

  const totalPaid = totalPaidForPlot(
    plot,
    payments,
  );

  return totalPaid >= RESERVE_THRESHOLD
    ? "reserved"
    : "booked";
}

// ============================================================
// File Export Helpers
// ============================================================

export function downloadCSV(
  filename: string,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);

  const escape = (value: unknown) => {
    const stringValue =
      value == null ? "" : String(value);

    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(
        /"/g,
        '""',
      )}"`;
    }

    return stringValue;
  };

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) =>
          escape(row[header]),
        )
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

export function downloadJSON(
  filename: string,
  data: unknown,
) {
  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    {
      type: "application/json",
    },
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

export function downloadXLS(
  filename: string,
  rows: Record<string, unknown>[],
) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);

  const table = [
    "<table border='1'>",

    "<thead><tr>" +
      headers
        .map((header) => `<th>${header}</th>`)
        .join("") +
      "</tr></thead>",

    "<tbody>",

    ...rows.map(
      (row) =>
        "<tr>" +
        headers
          .map(
            (header) =>
              `<td>${
                row[header] == null
                  ? ""
                  : String(row[header]).replace(
                      /</g,
                      "&lt;",
                    )
              }</td>`,
          )
          .join("") +
        "</tr>",
    ),

    "</tbody>",

    "</table>",
  ].join("");

  const html = `
    <html
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
    >
      <head>
        <meta charset="utf-8">
      </head>
      <body>
        ${table}
      </body>
    </html>
  `;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

// ============================================================
// Generic HTML Printer
// ============================================================

export function printHTML(
  title: string,
  bodyHTML: string,
) {
  const w = window.open(
    "",
    "_blank",
    "width=900,height=650",
  );

  if (!w) return;

  w.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${title}</title>

        <style>
          body {
            font-family: Inter, system-ui, sans-serif;
            padding: 24px;
            color: #0f172a;
          }

          h1 {
            font-size: 20px;
            margin-bottom: 4px;
          }

          .meta {
            color: #64748b;
            font-size: 12px;
            margin-bottom: 20px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th,
          td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            text-align: left;
            font-size: 12px;
          }

          th {
            background: #f1f5f9;
          }

          .footer {
            margin-top: 24px;
            color: #94a3b8;
            font-size: 11px;
          }
        </style>
      </head>

      <body>
        <h1>${title}</h1>

        <div class="meta">
          Generated on
          ${new Date().toLocaleString("en-IN")}
          · VGG Infra Developers CRM
        </div>

        ${bodyHTML}

        <div class="footer">
          VGG Infra Developers Pvt Ltd — Confidential
        </div>
      </body>
    </html>
  `);

  w.document.close();
  w.focus();

  setTimeout(() => {
    w.print();
  }, 300);
}

// ============================================================
// ID Generator
// ============================================================

export function uid2(
  prefix = "id",
) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// ============================================================
// EMI CALCULATOR
//
// Formula:
//
// pendingAmount = totalAmount - paidAmount
//
// years = tenureMonths / 12
//
// totalInterest =
// pendingAmount × (annualRate / 100) × years
//
// totalWithInterest =
// pendingAmount + totalInterest
//
// rawEMI =
// totalWithInterest / tenureMonths
//
// monthlyEMI =
// rawEMI rounded to nearest ₹100
// ============================================================

export interface EMIInput {
  /**
   * Total cost of the plot/property.
   */
  totalAmount: number;

  /**
   * Amount already paid as advance/down payment.
   */
  paidAmount: number;

  /**
   * Annual interest rate in percentage.
   */
  annualRate: number;

  /**
   * EMI tenure in months.
   */
  tenureMonths: number;
}

export interface EMIResult {
  /**
   * Total amount remaining after paid amount.
   */
  pendingAmount: number;

  /**
   * Total simple interest for the entire tenure.
   */
  totalInterest: number;

  /**
   * EMI amount payable every month.
   */
  monthlyEMI: number;

  /**
   * Total amount payable through EMI.
   */
  totalPayable: number;

  /**
   * Month-by-month EMI schedule.
   */
  schedule: Array<{
    month: number;
    emi: number;
    balance: number;
  }>;
}

export function calculateEMI(
  input: EMIInput,
): EMIResult {
  const {
    totalAmount,
    paidAmount,
    annualRate,
    tenureMonths,
  } = input;

  const safeTotalAmount = Math.max(
    0,
    Number(totalAmount) || 0,
  );

  const safePaidAmount = Math.max(
    0,
    Number(paidAmount) || 0,
  );

  const safeAnnualRate = Math.max(
    0,
    Number(annualRate) || 0,
  );

  const safeTenureMonths = Math.max(
    1,
    Math.round(
      Number(tenureMonths) || 1,
    ),
  );

  // Total − Paid
  const pendingAmount = Math.max(
    0,
    safeTotalAmount - safePaidAmount,
  );

  // Months → Years
  const years =
    safeTenureMonths / 12;

  // Simple Interest
  const totalInterest =
    pendingAmount *
    (safeAnnualRate / 100) *
    years;

  // Principal + Interest
  const totalWithInterest =
    pendingAmount + totalInterest;

  // Raw EMI
  const rawEMI =
    totalWithInterest /
    safeTenureMonths;

  // Round to nearest ₹100
  const monthlyEMI =
    Math.round(
      rawEMI / 100,
    ) * 100;

  // Total payable via EMI
  const totalPayable =
    monthlyEMI *
    safeTenureMonths;

  // Schedule
  const schedule: EMIResult["schedule"] =
    [];

  let balance = totalPayable;

  for (
    let month = 1;
    month <= safeTenureMonths;
    month++
  ) {
    const payment = Math.min(
      monthlyEMI,
      Math.max(0, balance),
    );

    balance = Math.max(
      0,
      balance - payment,
    );

    schedule.push({
      month,
      emi: payment,
      balance,
    });
  }

  return {
    pendingAmount,
    totalInterest,
    monthlyEMI,
    totalPayable,
    schedule,
  };
}

// ============================================================
// Professional Payment Receipt Printer
// ============================================================

export interface ReceiptContext {
  payment: Payment;
  plot?: Plot;
  customer?: Customer;
  booking?: Booking;
  sale?: Sale;
  company: CompanySettings;
  projectName?: string;
  outstandingAfterPayment?: number;
  totalPaidToDate?: number;
  receiptNumber?: string;
}

export function printPaymentReceipt(
  ctx: ReceiptContext,
) {
  const {
    payment,
    plot,
    customer,
    company,
    projectName,
    outstandingAfterPayment,
    totalPaidToDate,
    receiptNumber,
  } = ctx;

  const receiptNo =
    receiptNumber ??
    payment.referenceNumber ??
    `RCT-${payment.id
      .slice(-8)
      .toUpperCase()}`;

  const w = window.open(
    "",
    "_blank",
    "width=900,height=650",
  );

  if (!w) return;

  const modeLabel = (mode: string) =>
    mode.replace(
      /_/g,
      " ",
    ).toUpperCase();

  const logoBlock =
    company.companyLogo
      ? `
        <img
          src="${company.companyLogo}"
          alt="logo"
          style="
            max-height:60px;
            max-width:180px;
            object-fit:contain
          "
        />
      `
      : `
        <div
          style="
            font-size:24px;
            font-weight:800;
            letter-spacing:-0.5px;
            color:#1e293b
          "
        >
          ${
            company.companyName ||
            "VGG Infra Developers"
          }
        </div>
      `;

  const bankDetailsRow =
    company.bankDetails
      ? `
        <tr>
          <td
            colspan="2"
            style="
              background:#f8fafc;
              padding:10px 14px;
              border-radius:8px
            "
          >
            <div
              style="
                font-size:11px;
                font-weight:600;
                color:#475569;
                margin-bottom:4px;
                text-transform:uppercase;
                letter-spacing:0.5px
              "
            >
              Bank Details
            </div>

            <div
              style="
                font-size:12px;
                color:#334155;
                line-height:1.6
              "
            >
              ${
                company.bankDetails.bankName
                  ? `<strong>Bank:</strong> ${company.bankDetails.bankName}`
                  : ""
              }

              ${
                company.bankDetails.accountName
                  ? ` &nbsp;·&nbsp; <strong>A/C Name:</strong> ${company.bankDetails.accountName}`
                  : ""
              }

              ${
                company.bankDetails.accountNumber
                  ? ` &nbsp;·&nbsp; <strong>A/C #:</strong> ${company.bankDetails.accountNumber}`
                  : ""
              }

              ${
                company.bankDetails.ifsc
                  ? ` &nbsp;·&nbsp; <strong>IFSC:</strong> ${company.bankDetails.ifsc}`
                  : ""
              }

              ${
                company.bankDetails.branch
                  ? ` &nbsp;·&nbsp; <strong>Branch:</strong> ${company.bankDetails.branch}`
                  : ""
              }

              ${
                company.upi
                  ? ` &nbsp;·&nbsp; <strong>UPI:</strong> ${company.upi}`
                  : ""
              }
            </div>
          </td>
        </tr>
      `
      : company.upi
        ? `
          <tr>
            <td
              colspan="2"
              style="
                background:#f8fafc;
                padding:10px 14px;
                border-radius:8px;
                font-size:12px
              "
            >
              <strong>UPI:</strong>
              ${company.upi}
            </td>
          </tr>
        `
        : "";

  const bodyHTML = `
    <div
      style="
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        margin-bottom:16px;
        border-bottom:2px solid #1e293b;
        padding-bottom:16px
      "
    >
      <div>
        ${logoBlock}

        <div
          style="
            font-size:12px;
            color:#475569;
            margin-top:6px;
            line-height:1.5
          "
        >
          ${
            company.address
              ? `${company.address}<br/>`
              : ""
          }

          ${
            company.phone
              ? `Phone: ${company.phone}`
              : ""
          }

          ${
            company.email
              ? ` &nbsp;·&nbsp; Email: ${company.email}`
              : ""
          }

          ${
            company.gst
              ? `<br/>GST: ${company.gst}`
              : ""
          }
        </div>
      </div>

      <div style="text-align:right">
        <div
          style="
            font-size:18px;
            font-weight:700;
            color:#1e293b
          "
        >
          PAYMENT RECEIPT
        </div>

        <div
          style="
            font-size:12px;
            color:#475569;
            margin-top:4px
          "
        >
          Receipt #:
          <strong
            style="font-family:monospace"
          >
            ${receiptNo}
          </strong>
        </div>

        <div
          style="
            font-size:12px;
            color:#475569
          "
        >
          Date:
          ${formatDate(payment.date)}
        </div>
      </div>
    </div>

    <table
      style="
        width:100%;
        border-collapse:collapse;
        margin-bottom:16px
      "
    >
      <tr>
        <td
          style="
            width:50%;
            vertical-align:top;
            padding:10px 14px;
            background:#f8fafc;
            border-radius:8px
          "
        >
          <div
            style="
              font-size:11px;
              font-weight:600;
              color:#475569;
              margin-bottom:6px;
              text-transform:uppercase;
              letter-spacing:0.5px
            "
          >
            Received From
          </div>

          <div
            style="
              font-size:14px;
              font-weight:700;
              color:#1e293b
            "
          >
            ${customer?.name ?? "—"}
          </div>

          ${
            customer?.phone
              ? `
                <div
                  style="
                    font-size:12px;
                    color:#475569
                  "
                >
                  Phone: ${customer.phone}
                </div>
              `
              : ""
          }

          ${
            customer?.email
              ? `
                <div
                  style="
                    font-size:12px;
                    color:#475569
                  "
                >
                  Email: ${customer.email}
                </div>
              `
              : ""
          }

          ${
            customer?.address
              ? `
                <div
                  style="
                    font-size:12px;
                    color:#475569;
                    margin-top:4px
                  "
                >
                  ${customer.address}
                </div>
              `
              : ""
          }
        </td>

        <td
          style="
            width:50%;
            vertical-align:top;
            padding:10px 14px;
            background:#f8fafc;
            border-radius:8px
          "
        >
          <div
            style="
              font-size:11px;
              font-weight:600;
              color:#475569;
              margin-bottom:6px;
              text-transform:uppercase;
              letter-spacing:0.5px
            "
          >
            Plot Details
          </div>

          ${
            plot
              ? `
                <div
                  style="
                    font-size:14px;
                    font-weight:700;
                    color:#1e293b
                  "
                >
                  Plot ${plot.plotNumber}
                </div>

                ${
                  projectName
                    ? `
                      <div
                        style="
                          font-size:12px;
                          color:#475569
                        "
                      >
                        ${projectName}
                      </div>
                    `
                    : ""
                }

                <div
                  style="
                    font-size:12px;
                    color:#475569;
                    margin-top:2px
                  "
                >
                  ${
                    plot.size
                      ? `${plot.size} ${
                          plot.sizeUnit ??
                          "cents"
                        }`
                      : ""
                  }

                  ${
                    plot.facing
                      ? ` &nbsp;·&nbsp; Facing: ${plot.facing}`
                      : ""
                  }

                  ${
                    plot.cornerPlot
                      ? ` &nbsp;·&nbsp; Corner`
                      : ""
                  }
                </div>
              `
              : `
                <div
                  style="
                    font-size:12px;
                    color:#94a3b8
                  "
                >
                  —
                </div>
              `
          }
        </td>
      </tr>
    </table>

    <table
      style="
        width:100%;
        border-collapse:collapse;
        margin-bottom:16px;
        font-size:13px
      "
    >
      <thead>
        <tr
          style="
            background:#1e293b;
            color:white
          "
        >
          <th
            style="
              padding:10px 14px;
              text-align:left;
              font-size:11px;
              text-transform:uppercase;
              letter-spacing:0.5px
            "
          >
            Description
          </th>

          <th
            style="
              padding:10px 14px;
              text-align:right;
              font-size:11px;
              text-transform:uppercase;
              letter-spacing:0.5px
            "
          >
            Amount
          </th>
        </tr>
      </thead>

      <tbody>
        <tr
          style="
            border-bottom:1px solid #e2e8f0
          "
        >
          <td style="padding:12px 14px">
            <div style="font-weight:600">
              Payment Received
            </div>

            <div
              style="
                font-size:11px;
                color:#64748b
              "
            >
              Mode:
              ${modeLabel(
                payment.paymentMode,
              )}

              ${
                payment.bank
                  ? ` · Bank: ${payment.bank}`
                  : ""
              }

              ${
                payment.chequeNumber
                  ? ` · Cheque #: ${payment.chequeNumber}`
                  : ""
              }

              ${
                payment.transactionId
                  ? ` · Txn ID: ${payment.transactionId}`
                  : ""
              }
            </div>

            ${
              payment.remarks
                ? `
                  <div
                    style="
                      font-size:11px;
                      color:#64748b;
                      margin-top:2px;
                      font-style:italic
                    "
                  >
                    ${payment.remarks}
                  </div>
                `
                : ""
            }
          </td>

          <td
            style="
              padding:12px 14px;
              text-align:right;
              font-weight:700;
              font-size:15px
            "
          >
            ${inr(payment.amount)}
          </td>
        </tr>

        ${
          totalPaidToDate !== undefined
            ? `
              <tr
                style="
                  border-bottom:1px solid #e2e8f0
                "
              >
                <td
                  style="
                    padding:8px 14px;
                    color:#475569
                  "
                >
                  Total Paid to Date
                  (this plot)
                </td>

                <td
                  style="
                    padding:8px 14px;
                    text-align:right
                  "
                >
                  ${inr(totalPaidToDate)}
                </td>
              </tr>
            `
            : ""
        }

        ${
          outstandingAfterPayment !==
          undefined
            ? `
              <tr
                style="
                  background:#fef3c7
                "
              >
                <td
                  style="
                    padding:10px 14px;
                    font-weight:600;
                    color:#92400e
                  "
                >
                  Outstanding Balance
                </td>

                <td
                  style="
                    padding:10px 14px;
                    text-align:right;
                    font-weight:700;
                    color:#92400e
                  "
                >
                  ${inr(
                    outstandingAfterPayment,
                  )}
                </td>
              </tr>
            `
            : ""
        }
      </tbody>
    </table>

    ${
      bankDetailsRow
        ? `
          <table
            style="
              width:100%;
              margin-bottom:24px
            "
          >
            ${bankDetailsRow}
          </table>
        `
        : ""
    }

    <div
      style="
        display:flex;
        justify-content:space-between;
        margin-top:40px
      "
    >
      <div
        style="
          font-size:11px;
          color:#94a3b8;
          max-width:55%;
          line-height:1.5
        "
      >
        This is a computer-generated receipt
        and does not require a physical signature.
        <br/>

        For any queries, please contact
        ${company.phone ?? "the office"}
        quoting receipt #${receiptNo}.
      </div>

      <div style="text-align:center">
        <div
          style="
            border-top:1px solid #475569;
            width:180px;
            padding-top:6px;
            font-size:11px;
            color:#475569
          "
        >
          Authorised Signatory
        </div>
      </div>
    </div>

    <div
      style="
        margin-top:20px;
        padding-top:12px;
        border-top:1px solid #e2e8f0;
        text-align:center;
        font-size:10px;
        color:#94a3b8
      "
    >
      ${
        company.companyName ||
        "VGG Infra Developers"
      }

      · Generated on
      ${new Date().toLocaleString("en-IN")}
    </div>
  `;

  w.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>
          Receipt ${receiptNo}
        </title>

        <style>
          body {
            font-family:
              Inter,
              system-ui,
              sans-serif;

            padding:32px;
            color:#0f172a;
            max-width:800px;
            margin:0 auto;
          }

          @media print {
            body {
              padding:16px;
            }

            @page {
              margin:12mm;
            }
          }
        </style>
      </head>

      <body>
        ${bodyHTML}
      </body>
    </html>
  `);

  w.document.close();
  w.focus();

  setTimeout(() => {
    w.print();
  }, 350);
}

// ============================================================
// EMI Schedule Printer
// ============================================================

export interface EMIPrintContext {
  input: EMIInput;
  result: EMIResult;
  company: CompanySettings;
  plot?: Plot;
  projectName?: string;
  customer?: Customer;
}

export function printEMISchedule(
  ctx: EMIPrintContext,
) {
  const {
    input,
    result,
    company,
    plot,
    projectName,
    customer,
  } = ctx;

  const w = window.open(
    "",
    "_blank",
    "width=900,height=650",
  );

  if (!w) return;

  const rows = result.schedule
    .map(
      (schedule) => `
        <tr>
          <td
            style="
              padding:6px 10px;
              border-bottom:1px solid #e2e8f0
            "
          >
            ${schedule.month}
          </td>

          <td
            style="
              padding:6px 10px;
              border-bottom:1px solid #e2e8f0;
              text-align:right
            "
          >
            ${inr(schedule.emi)}
          </td>

          <td
            style="
              padding:6px 10px;
              border-bottom:1px solid #e2e8f0;
              text-align:right
            "
          >
            ${inr(schedule.balance)}
          </td>
        </tr>
      `,
    )
    .join("");

  const bodyHTML = `
    <div
      style="
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        margin-bottom:16px;
        border-bottom:2px solid #1e293b;
        padding-bottom:16px
      "
    >
      <div>
        <div
          style="
            font-size:20px;
            font-weight:800;
            letter-spacing:-0.5px;
            color:#1e293b
          "
        >
          ${
            company.companyName ||
            "VGG Infra Developers"
          }
        </div>

        <div
          style="
            font-size:12px;
            color:#475569;
            margin-top:4px
          "
        >
          ${company.address ?? ""}

          ${
            company.phone
              ? ` &nbsp;·&nbsp; ${company.phone}`
              : ""
          }
        </div>
      </div>

      <div style="text-align:right">
        <div
          style="
            font-size:18px;
            font-weight:700;
            color:#1e293b
          "
        >
          EMI SCHEDULE
        </div>

        <div
          style="
            font-size:12px;
            color:#475569;
            margin-top:4px
          "
        >
          Generated:
          ${formatDate(
            new Date().toISOString(),
          )}
        </div>
      </div>
    </div>

    ${
      plot
        ? `
          <table
            style="
              width:100%;
              border-collapse:collapse;
              margin-bottom:16px;
              font-size:12px
            "
          >
            <tr>
              <td
                style="
                  padding:8px 12px;
                  background:#f8fafc;
                  border-radius:6px;
                  width:50%;
                  vertical-align:top
                "
              >
                <div
                  style="
                    font-size:10px;
                    font-weight:600;
                    color:#475569;
                    text-transform:uppercase;
                    margin-bottom:4px
                  "
                >
                  Plot
                </div>

                <div style="font-weight:700">
                  Plot ${plot.plotNumber}
                </div>

                ${
                  projectName
                    ? `
                      <div
                        style="
                          color:#64748b
                        "
                      >
                        ${projectName}
                      </div>
                    `
                    : ""
                }

                <div
                  style="
                    color:#64748b;
                    margin-top:2px
                  "
                >
                  ${plot.size}
                  ${plot.sizeUnit ?? "cents"}

                  ${
                    plot.facing
                      ? ` · ${plot.facing}`
                      : ""
                  }

                  ${
                    plot.cornerPlot
                      ? " · Corner"
                      : ""
                  }
                </div>
              </td>

              <td
                style="
                  padding:8px 12px;
                  background:#f8fafc;
                  border-radius:6px;
                  width:50%;
                  vertical-align:top
                "
              >
                <div
                  style="
                    font-size:10px;
                    font-weight:600;
                    color:#475569;
                    text-transform:uppercase;
                    margin-bottom:4px
                  "
                >
                  Customer
                </div>

                <div style="font-weight:700">
                  ${customer?.name ?? "—"}
                </div>

                ${
                  customer?.phone
                    ? `
                      <div
                        style="
                          color:#64748b
                        "
                      >
                        ${customer.phone}
                      </div>
                    `
                    : ""
                }
              </td>
            </tr>
          </table>
        `
        : ""
    }

    <table
      style="
        width:100%;
        border-collapse:collapse;
        margin-bottom:16px
      "
    >
      <tr>
        <td
          style="
            padding:10px 12px;
            background:#eff6ff;
            border-radius:6px;
            text-align:center
          "
        >
          <div
            style="
              font-size:10px;
              color:#1e40af;
              text-transform:uppercase;
              font-weight:600
            "
          >
            Total Amount
          </div>

          <div
            style="
              font-size:16px;
              font-weight:700;
              color:#1e3a8a
            "
          >
            ${inr(input.totalAmount)}
          </div>
        </td>

        <td
          style="
            padding:10px 12px;
            background:#eff6ff;
            border-radius:6px;
            text-align:center
          "
        >
           <div
            style="
              font-size:10px;
              color:#1e40af;
              text-transform:uppercase;
              font-weight:600
            "
          >
            Paid Amount
          </div>

          <div
            style="
              font-size:16px;
              font-weight:700;
              color:#1e3a8a
            "
          >
            ${inr(input.paidAmount)}
          </div>
        </td>

        <td
          style="
            padding:10px 12px;
            background:#eff6ff;
            border-radius:6px;
            text-align:center
          "
        >
          <div
            style="
              font-size:10px;
              color:#1e40af;
              text-transform:uppercase;
              font-weight:600
            "
          >
            Total Payable
          </div>

          <div
            style="
              font-size:16px;
              font-weight:700;
              color:#1e3a8a
            "
          >
            ${inr(result.totalPayable)}
          </div>
        </td>

        <td
          style="
            padding:10px 12px;
            background:#eff6ff;
            border-radius:6px;
            text-align:center
          "
        >
         
          <div
            style="
              font-size:10px;
              color:#1e40af;
              text-transform:uppercase;
              font-weight:600
            "
          >
            Tenure
          </div>

          <div
            style="
              font-size:16px;
              font-weight:700;
              color:#1e3a8a
            "
          >
            ${input.tenureMonths} mo
          </div>
        </td>
      </tr>

      <tr>
        <td
          colspan="2"
          style="
            padding:8px 12px;
            text-align:center;
            background:#f1f5f9;
            border-radius:6px
          "
        >
          <div
            style="
              font-size:10px;
              color:#475569;
              text-transform:uppercase
            "
          >
            Pending Amount
          </div>

          <div
            style="
              font-size:13px;
              font-weight:700
            "
          >
            ${inr(result.pendingAmount)}
          </div>
        </td>

        <td
          colspan="2"
          style="
            padding:8px 12px;
            text-align:center;
            background:#1e3a8a;
            border-radius:6px
          "
        >
          <div
            style="
              font-size:10px;
              color:#bfdbfe;
              text-transform:uppercase
            "
          >
           Monthly EMI
          </div>

          <div
            style="
              font-size:13px;
              font-weight:700;
              color:white
            "
          >
            ${inr(result.monthlyEMI)}
          </div>
        </td>
      </tr>

      <tr>
        <td
          colspan="4"
          style="
            padding:8px 12px;
            text-align:center;
            background:#fef3c7;
            border-radius:6px
          "
        >
        


        
        </td>
      </tr>
    </table>

    <table
      style="
        width:100%;
        border-collapse:collapse;
        font-size:11px
      "
    >
      <thead>
        <tr
          style="
            background:#1e293b;
            color:white
          "
        >
          <th
            style="
              padding:8px 10px;
              text-align:left
            "
          >
            Month
          </th>

          <th
            style="
              padding:8px 10px;
              text-align:right
            "
          >
            EMI
          </th>

          <th
            style="
              padding:8px 10px;
              text-align:right
            "
          >
            Balance
          </th>
        </tr>
      </thead>

      <tbody>
        ${rows}
      </tbody>
    </table>

    <div
      style="
        margin-top:20px;
        padding-top:12px;
        border-top:1px solid #e2e8f0;
        text-align:center;
        font-size:10px;
        color:#94a3b8
      "
    >
      ${
        company.companyName ||
        "VGG Infra Developers"
      }

      · EMI calculation is indicative only.
    </div>
  `;

  w.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>
          EMI Schedule
        </title>

        <style>
          body {
            font-family:
              Inter,
              system-ui,
              sans-serif;

            padding:24px;
            color:#0f172a;
            max-width:900px;
            margin:0 auto;
          }

          @media print {
            @page {
              margin:12mm;
            }
          }
        </style>
      </head>

      <body>
        ${bodyHTML}
      </body>
    </html>
  `);

  w.document.close();
  w.focus();

  setTimeout(() => {
    w.print();
  }, 350);
}

