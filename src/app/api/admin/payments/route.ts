import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import { getPaymentsSupabase } from "@/lib/agent/payments-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// /api/admin/payments — the approval queue.
//
// This is the ONE place a payment amount is readable. It writes straight to
// the same `payments` table the admin-dashboard reads, so approving here
// updates the original DB and the website immediately.
//
// GET   ?id=<paymentId>                     full plot + customer + ledger detail
// GET   ?status=pending|approved|rejected|all  queue (default pending)
// PATCH { id, decision: "approve" | "reject", remark? }

const DECISIONS = ["approve", "reject"] as const;

type Decision = (typeof DECISIONS)[number];

/**
 * Everything an approver needs to judge one recording: the payment itself,
 * the plot it lands on, its project/layout, the customer, the originating
 * booking, and the plot's ledger position (price, discount, paid to date,
 * what is still owed). Money appears here because this is the approval
 * screen — it is the only place any figure is rendered.
 */
async function loadDetail(
  sb: NonNullable<ReturnType<typeof getPaymentsSupabase>>,
  id: string,
) {
  const { data: payment, error } = await sb
    .from("payments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: "Could not load payment." as const, status: 500 as const };
  if (!payment) return { error: "Payment not found." as const, status: 404 as const };

  const p = payment as Record<string, unknown>;
  const plotId = p.plot_id as string | null;
  const customerId = p.customer_id as string | null;
  const bookingId = p.booking_id as string | null;
  const saleId = p.sale_id as string | null;

  const [plotRes, custRes, bookRes, saleRes] = await Promise.all([
    plotId
      ? sb.from("plots").select("*").eq("id", plotId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    customerId
      ? sb.from("customers").select("*").eq("id", customerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    bookingId
      ? sb.from("bookings").select("*").eq("id", bookingId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    saleId ? sb.from("sales").select("*").eq("id", saleId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  const plot = (plotRes.data ?? null) as Record<string, unknown> | null;

  const [projectRes, layoutRes] = await Promise.all([
    plot?.project_id
      ? sb.from("projects").select("*").eq("id", plot.project_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
    plot?.layout_id
      ? sb.from("layouts").select("*").eq("id", plot.layout_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Ledger position for this plot: everything already approved, net of the
  // discount from whichever of booking/sale applies.
  const { data: approvedRows } = await sb
    .from("payments")
    .select("amount")
    .eq("plot_id", plotId ?? "")
    .eq("status", "approved");
  const paidToDate = (approvedRows ?? []).reduce((s, r) => s + (r.amount || 0), 0);

  const booking = (bookRes.data ?? null) as Record<string, unknown> | null;
  const sale = (saleRes.data ?? null) as Record<string, unknown> | null;
  const discount = Number(
    (sale?.discount as number | undefined) ?? (booking?.discount as number | undefined) ?? 0,
  );
  const grossPrice = Number(plot?.total_price ?? 0);
  const netPrice = Math.max(0, grossPrice - discount);

  const customer = custRes.data as Record<string, unknown> | null;
  const project = projectRes.data as Record<string, unknown> | null;
  const layout = layoutRes.data as Record<string, unknown> | null;

  return {
    payment: {
      id: p.id,
      amount: p.amount,
      date: p.date,
      paymentMode: p.payment_mode,
      referenceNumber: p.reference_number ?? null,
      bank: p.bank ?? null,
      chequeNumber: p.cheque_number ?? null,
      transactionId: p.transaction_id ?? null,
      remarks: p.remarks ?? null,
      status: p.status ?? "pending",
      rejectionRemark: p.rejection_remark ?? null,
      approvedAt: p.approved_at ?? null,
      recordedBy: p.recorded_by ?? null,
      recordedByName: p.recorded_by_name ?? null,
      proofUrls: Array.isArray(p.proof_urls) ? p.proof_urls : [],
      createdAt: p.created_at,
    },
    plot: plot
      ? {
          id: plot.id,
          plotNumber: plot.plot_number,
          block: plot.block,
          size: plot.size,
          sizeUnit: plot.size_unit,
          facing: plot.facing,
          status: plot.status,
          cornerPlot: plot.corner_plot,
          roadWidth: plot.road_width,
          notes: plot.notes,
          totalPrice: plot.total_price,
          basePricePerUnit: plot.base_price_per_unit,
          frozenPrice: plot.frozen_price,
          pricePerCent: plot.price_per_cent,
        }
      : null,
    project: project
      ? {
          id: project.id,
          name: project.name,
          location: project.location,
          totalArea: project.total_area,
          numberOfPlots: project.number_of_plots,
        }
      : null,
    layout: layout ? { id: layout.id, name: layout.name, numberOfPlots: layout.number_of_plots } : null,
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          fatherName: customer.father_name,
          phone: customer.phone,
          alternatePhone: customer.alternate_phone,
          email: customer.email,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          pinCode: customer.pin_code,
          occupation: customer.occupation,
          pan: customer.pan,
          aadhaar: customer.aadhaar,
          remarks: customer.remarks,
        }
      : null,
    booking: booking
      ? {
          id: booking.id,
          referenceCode: booking.reference_code,
          bookingDate: booking.booking_date,
          advancePaid: booking.advance_paid,
          paymentMethod: booking.payment_method,
          expectedRegistrationDate: booking.expected_registration_date,
          status: booking.status,
          discount: booking.discount,
          originalPlotPrice: booking.original_plot_price,
          originalPlotSize: booking.original_plot_size,
          remarks: booking.remarks,
        }
      : null,
    ledger: {
      grossPrice,
      discount,
      netPrice,
      paidToDate,
      outstanding: Math.max(0, netPrice - paidToDate),
    },
  };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdminSession(req);
  if (!gate.authorized) return gate.response;

  const sb = getPaymentsSupabase();
  if (!sb) {
    return NextResponse.json({ error: "Service not configured." }, { status: 503 });
  }

  // Single-payment detail (full plot + customer + ledger).
  const singleId = req.nextUrl.searchParams.get("id")?.trim();
  if (singleId) {
    const detail = await loadDetail(sb, singleId);
    if ("error" in detail) {
      return NextResponse.json({ error: detail.error }, { status: detail.status });
    }
    return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
  }

  const status = req.nextUrl.searchParams.get("status")?.trim() ?? "pending";

  // Badge-only request: exact head count, no rows.
  if (req.nextUrl.searchParams.get("countOnly")) {
    const { count, error } = await sb
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    if (error) {
      return NextResponse.json({ error: "Could not load count." }, { status: 500 });
    }
    return NextResponse.json(
      { count: count ?? 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  let query = sb.from("payments").select("*").order("created_at", { ascending: false }).limit(200);
  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Could not load payments." }, { status: 500 });
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const plotIds = [...new Set(rows.map((r) => r.plot_id as string).filter(Boolean))];
  const custIds = [...new Set(rows.map((r) => r.customer_id as string).filter(Boolean))];

  const [plotRes, custRes] = await Promise.all([
    plotIds.length
      ? sb.from("plots").select("id, plot_number, block").in("id", plotIds)
      : Promise.resolve({ data: [] as { id: string; plot_number: string; block: string }[] }),
    custIds.length
      ? sb.from("customers").select("id, name, phone").in("id", custIds)
      : Promise.resolve({ data: [] as { id: string; name: string; phone: string }[] }),
  ]);

  const plotById = new Map(
    ((plotRes.data ?? []) as { id: string; plot_number: string; block: string }[]).map((p) => [p.id, p]),
  );
  const custById = new Map(
    ((custRes.data ?? []) as { id: string; name: string; phone: string }[]).map((c) => [c.id, c]),
  );

  const items = rows.map((r) => {
    const plot = r.plot_id ? plotById.get(r.plot_id as string) : undefined;
    const customer = r.customer_id ? custById.get(r.customer_id as string) : undefined;
    return {
      id: r.id,
      amount: r.amount,
      date: r.date,
      paymentMode: r.payment_mode,
      referenceNumber: r.reference_number ?? null,
      bank: r.bank ?? null,
      chequeNumber: r.cheque_number ?? null,
      transactionId: r.transaction_id ?? null,
      remarks: r.remarks ?? null,
      status: r.status ?? "pending",
      rejectionRemark: r.rejection_remark ?? null,
      approvedAt: r.approved_at ?? null,
      recordedBy: r.recorded_by ?? null,
      recordedByName: r.recorded_by_name ?? null,
      proofCount: Array.isArray(r.proof_urls) ? r.proof_urls.length : 0,
      proofs: Array.isArray(r.proof_urls) ? r.proof_urls : [],
      createdAt: r.created_at,
      plotNumber: plot?.plot_number ?? null,
      plotBlock: plot?.block ?? null,
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
    };
  });

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdminSession(req);
  if (!gate.authorized) return gate.response;

  const sb = getPaymentsSupabase();
  if (!sb) {
    return NextResponse.json({ error: "Service not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  const decision = String(body?.decision ?? "") as Decision;
  const remark = body?.remark ? String(body.remark).trim() : "";

  if (!id) return NextResponse.json({ error: "Payment id is required." }, { status: 400 });
  if (!DECISIONS.includes(decision)) {
    return NextResponse.json({ error: "Unknown decision." }, { status: 400 });
  }
  if (decision === "reject" && !remark) {
    return NextResponse.json({ error: "A reason is required to reject." }, { status: 400 });
  }

  // Optimistic guard: only a still-pending payment can be decided, so two
  // admins cannot both approve and double-count the same recording.
  const now = new Date().toISOString();
  const patch =
    decision === "approve"
      ? {
          status: "approved",
          approved_at: now,
          approved_by: gate.employee.id,
          rejection_remark: null,
        }
      : {
          status: "rejected",
          rejection_remark: remark,
          approved_at: null,
          approved_by: gate.employee.id,
        };

  const { data, error } = await sb
    .from("payments")
    .update(patch)
    .eq("id", id)
    .eq("status", "pending")
    .select("id, status");

  if (error) {
    return NextResponse.json({ error: "Could not update payment." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "That payment is no longer pending." },
      { status: 409 },
    );
  }

  return NextResponse.json({ item: data[0] });
}
