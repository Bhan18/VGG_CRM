import { NextRequest, NextResponse } from "next/server";
import { requireBranchManager } from "@/lib/agent/bm-guard";
import { getPaymentsSupabase } from "@/lib/agent/payments-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/bm/customers — customers with a live outstanding balance only.
//
// Money never leaves the server: the figures below exist purely to decide
// *who* appears and *which* plots they can pay against. The response carries
// no amount, price, paid, balance or total — the BM sees identities and plot
// numbers, never figures. Balance math mirrors the admin app (discounts
// included) so a cleared customer drops off the list.

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
};

export async function GET(req: NextRequest) {
  const gate = await requireBranchManager(req);
  if (!gate.authorized) return gate.response;

  const sb = getPaymentsSupabase();
  if (!sb) {
    return NextResponse.json({ error: "Service not configured." }, { status: 503 });
  }

  const { data: plots, error: plotErr } = await sb
    .from("plots")
    .select("*")
    .in("status", ["booked", "reserved", "sold"])
    .not("customer_id", "is", null)
    .order("plot_number", { ascending: true });
  if (plotErr) {
    return NextResponse.json({ error: "Could not load customers." }, { status: 500 });
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
      ? sb.from("customers").select("id, name, phone").in("id", customerIds).order("name", { ascending: true })
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
  const discountByBooking = new Map(((bookRes.data ?? []) as { id: string; discount: number }[]).map((b) => [b.id, b.discount ?? 0]));
  const discountBySale = new Map(((saleRes.data ?? []) as { id: string; discount: number }[]).map((s) => [s.id, s.discount ?? 0]));
  const projectById = new Map(((projRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  // Outstanding-only: a customer with nothing due is not actionable here.
  // The dues figure is used to rank (biggest first) and then discarded —
  // it never reaches the response.
  const ranked = ((custRes.data ?? []) as { id: string; name: string; phone: string }[])
    .map((c) => {
      const balances = rows
        .filter((p) => p.customer_id === c.id)
        .map((p) => {
          const paid = paidByPlot.get(p.id) ?? 0;
          let owed = p.total_price ?? 0;
          if (p.sale_id && discountBySale.has(p.sale_id)) owed -= discountBySale.get(p.sale_id)!;
          else if (p.booking_id && discountByBooking.has(p.booking_id)) owed -= discountByBooking.get(p.booking_id)!;
          return { plot: p, balance: Math.max(0, Math.max(0, owed) - paid) };
        });
      return {
        customer: c,
        balances,
        totalOutstanding: balances.reduce((s, b) => s + b.balance, 0),
      };
    })
    .filter((e) => e.totalOutstanding > 0)
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  const customers = ranked.map(({ customer: c, balances }) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    plots: balances
      // Only plots that still owe something are collectable.
      .filter((b) => b.balance > 0)
      .map(({ plot: p }) => ({
        id: p.id,
        plotNumber: p.plot_number,
        block: p.block,
        status: p.status,
        projectName: p.project_id ? (projectById.get(p.project_id) ?? null) : null,
        bookingId: p.booking_id,
        saleId: p.sale_id,
      })),
  }));

  return NextResponse.json(
    { items: customers },
    { headers: { "Cache-Control": "no-store" } },
  );
}
