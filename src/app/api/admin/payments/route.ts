import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import { getServerSupabase } from "@/lib/agent/server-supabase";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Admin payment approvals (staff app). Lists BM-recorded pending payments
// with plot/customer labels, and approves/rejects them. Reads/writes the
// main project's `payments` table. Ledger math stays approved-only.

type PlotMini = { id: string; plot_number: string; block: string | null };
type CustMini = { id: string; name: string; phone: string | null };

async function labels(
  sb: NonNullable<ReturnType<typeof getServerSupabase>>,
  rows: Record<string, unknown>[],
) {
  const plotIds = [...new Set(rows.map((r) => r.plot_id).filter(Boolean))] as string[];
  const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
  const [plotRes, custRes] = await Promise.all([
    plotIds.length
      ? sb.from("plots").select("id, plot_number, block").in("id", plotIds)
      : Promise.resolve({ data: [] as PlotMini[] }),
    custIds.length
      ? sb.from("customers").select("id, name, phone").in("id", custIds)
      : Promise.resolve({ data: [] as CustMini[] }),
  ]);
  const plotById = new Map(((plotRes.data ?? []) as PlotMini[]).map((p) => [p.id, p]));
  const custById = new Map(((custRes.data ?? []) as CustMini[]).map((c) => [c.id, c]));
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: r.amount,
    paymentMode: r.payment_mode,
    referenceNumber: r.reference_number ?? null,
    bank: r.bank ?? null,
    chequeNumber: r.cheque_number ?? null,
    transactionId: r.transaction_id ?? null,
    remarks: r.remarks ?? null,
    status: r.status ?? "approved",
    recordedBy: r.recorded_by ?? null,
    recordedByName: r.recorded_by_name ?? null,
    approvedBy: r.approved_by ?? null,
    approvedAt: r.approved_at ?? null,
    rejectionRemark: r.rejection_remark ?? null,
    proofs: Array.isArray(r.proof_urls) ? r.proof_urls : [],
    createdAt: r.created_at,
    plotNumber: (r.plot_id && plotById.get(r.plot_id as string)?.plot_number) || null,
    plotBlock: (r.plot_id && plotById.get(r.plot_id as string)?.block) || null,
    customerName: (r.customer_id && custById.get(r.customer_id as string)?.name) || null,
    customerPhone: (r.customer_id && custById.get(r.customer_id as string)?.phone) || null,
  }));
}

/**
 * GET /api/admin/payments
 * Pending BM recordings + recently decided (last 50), for the admin queue.
 */
export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const guard = await requireAdminSession(req);
  if (!guard.authorized) return guard.response;

  const sb = getServerSupabase();
  if (!sb) return errorResponse("Service not configured.", 503);

  const [pendingRes, recentRes] = await Promise.all([
    sb.from("payments").select("*").eq("status", "pending").order("created_at", { ascending: true }).limit(100),
    sb
      .from("payments")
      .select("*")
      .in("status", ["approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (pendingRes.error) return errorResponse("Could not load pending payments.", 500);
  if (recentRes.error) return errorResponse("Could not load recent payments.", 500);

  const [pending, recent] = await Promise.all([
    labels(sb, (pendingRes.data ?? []) as Record<string, unknown>[]),
    labels(sb, (recentRes.data ?? []) as Record<string, unknown>[]),
  ]);

  return jsonNoCache({ pending, recent });
}, "admin/payments GET");

/**
 * POST /api/admin/payments
 * Body: { action: "approve" | "reject", id, remark? (required for reject) }
 */
export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const guard = await requireAdminSession(req);
  if (!guard.authorized) return guard.response;

  const sb = getServerSupabase();
  if (!sb) return errorResponse("Service not configured.", 503);

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const id = String(body?.id ?? "");
  if (!id || (action !== "approve" && action !== "reject")) {
    return errorResponse("action (approve|reject) and id are required.", 400);
  }

  const { data: existing, error: fetchError } = await sb
    .from("payments")
    .select("id, status, amount")
    .eq("id", id)
    .single();
  if (fetchError || !existing) return errorResponse("Payment not found.", 404);
  if (existing.status !== "pending") {
    return errorResponse(`Already ${existing.status} — refresh the queue.`, 409);
  }

  const adminTag = `${guard.employee.name} (${guard.employee.employee_code})`;
  if (action === "approve") {
    const { error } = await sb
      .from("payments")
      .update({
        status: "approved",
        approved_by: guard.employee.employee_code,
        approved_at: new Date().toISOString(),
        rejection_remark: null,
      })
      .eq("id", id)
      .eq("status", "pending");
    if (error) return errorResponse("Could not approve payment.", 500);
    return jsonNoCache({ ok: true, id, status: "approved", by: adminTag });
  }

  const remark = String(body?.remark ?? "").trim();
  if (!remark) return errorResponse("Rejection reason is required.", 400);
  const { error } = await sb
    .from("payments")
    .update({ status: "rejected", rejection_remark: remark })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return errorResponse("Could not reject payment.", 500);
  return jsonNoCache({ ok: true, id, status: "rejected", by: adminTag });
}, "admin/payments POST");
