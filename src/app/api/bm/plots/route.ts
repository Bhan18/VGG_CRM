import { NextRequest, NextResponse } from "next/server";
import { requireBranchManager } from "@/lib/agent/bm-guard";
import { getServerSupabase } from "@/lib/agent/server-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/bm/plots — plots a Branch Manager can record payments against
// (booked / reserved / sold), with customer + approved-paid + balance.
// Balance mirrors the admin app's outstanding math (discounts included).

type PlotRow = {
  id: string;
  plot_number: string;
  block: string | null;
  status: string;
  total_price: number;
  customer_id: string | null;
  booking_id: string | null;
  sale_id: string | null;
  project_id: string | null;
  layout_id: string | null;
};

export async function GET(req: NextRequest) {
  const gate = await requireBranchManager(req);
  if (!gate.authorized) return gate.response;

  const sb = getServerSupabase();
  if (!sb) {
    return NextResponse.json({ error: "Service not configured." }, { status: 503 });
  }

  const [{ data: plots, error: plotErr }] = await Promise.all([
    sb.from("plots").select("*").in("status", ["booked", "reserved", "sold"]).order("plot_number", { ascending: true }),
  ]);
  if (plotErr) {
    return NextResponse.json({ error: "Could not load plots." }, { status: 500 });
  }

  const rows = (plots ?? []) as PlotRow[];
  const plotIds = rows.map((p) => p.id);
  const customerIds = [...new Set(rows.map((p) => p.customer_id).filter(Boolean))] as string[];
  const bookingIds = [...new Set(rows.map((p) => p.booking_id).filter(Boolean))] as string[];
  const saleIds = [...new Set(rows.map((p) => p.sale_id).filter(Boolean))] as string[];
  const projectIds = [...new Set(rows.map((p) => p.project_id).filter(Boolean))] as string[];

  const [payRes, custRes, bookRes, saleRes, projRes] = await Promise.all([
    plotIds.length
      ? sb.from("payments").select("plot_id, amount").in("plot_id", plotIds).eq("status", "approved")
      : Promise.resolve({ data: [] as { plot_id: string; amount: number }[] }),
    customerIds.length
      ? sb.from("customers").select("id, name, phone").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; name: string; phone: string }[] }),
    bookingIds.length
      ? sb.from("bookings").select("id, discount").in("id", bookingIds)
      : Promise.resolve({ data: [] as { id: string; discount: number }[] }),
    saleIds.length
      ? sb.from("sales").select("id, discount").in("id", saleIds)
      : Promise.resolve({ data: [] as { id: string; discount: number }[] }),
    projectIds.length
      ? sb.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const paidByPlot = new Map<string, number>();
  for (const pay of (payRes.data ?? []) as { plot_id: string; amount: number }[]) {
    paidByPlot.set(pay.plot_id, (paidByPlot.get(pay.plot_id) ?? 0) + (pay.amount || 0));
  }
  const custById = new Map(((custRes.data ?? []) as { id: string; name: string; phone: string }[]).map((c) => [c.id, c]));
  const discountByBooking = new Map(((bookRes.data ?? []) as { id: string; discount: number }[]).map((b) => [b.id, b.discount ?? 0]));
  const discountBySale = new Map(((saleRes.data ?? []) as { id: string; discount: number }[]).map((s) => [s.id, s.discount ?? 0]));
  const projectById = new Map(((projRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const items = rows.map((p) => {
    const paid = paidByPlot.get(p.id) ?? 0;
    let owed = p.total_price ?? 0;
    if (p.sale_id && discountBySale.has(p.sale_id)) owed -= discountBySale.get(p.sale_id)!;
    else if (p.booking_id && discountByBooking.has(p.booking_id)) owed -= discountByBooking.get(p.booking_id)!;
    owed = Math.max(0, owed);
    const customer = p.customer_id ? custById.get(p.customer_id) ?? null : null;
    return {
      id: p.id,
      plotNumber: p.plot_number,
      block: p.block,
      status: p.status,
      totalPrice: p.total_price ?? 0,
      paid,
      balance: Math.max(0, owed - paid),
      customerId: p.customer_id,
      customerName: customer?.name ?? null,
      customerPhone: customer?.phone ?? null,
      bookingId: p.booking_id,
      saleId: p.sale_id,
      projectName: p.project_id ? (projectById.get(p.project_id) ?? null) : null,
    };
  });

  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "no-store" } },
  );
}
