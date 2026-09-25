import { NextRequest, NextResponse } from "next/server";
import { requireBranchManager, requireAdminDb } from "@/lib/agent/bm-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/bm/customers — every customer holding a recordable plot
// (booked / reserved / sold), with their plots. Sorted by pending
// descending. Balance math mirrors the admin app (discounts included).
//
// Display rules: the list itself carries no amounts; figures are revealed
// only after a customer is selected. Paid/total are computed server-side
// but never displayed.

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

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  alternate_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  occupation: string | null;
  photo: string | null;
  remarks: string | null;
};

export async function GET(req: NextRequest) {
  const gate = await requireBranchManager(req);
  if (!gate.authorized) return gate.response;

  const db = requireAdminDb();
  if (!db.ok) return db.response;
  const sb = db.sb;

  const { data: plots, error: plotErr } = await sb
    .from("plots")
    .select("*")
    .in("status", ["booked", "reserved", "sold"])
    .not("customer_id", "is", null)
    .order("plot_number", { ascending: true });
  if (plotErr) {
    console.error("[bm/customers] plots error:", plotErr.message);
    return NextResponse.json({ error: "Could not load customers.", detail: plotErr.message }, { status: 500 });
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
      ? sb
          .from("customers")
          .select("id, name, phone, alternate_phone, email, address, city, state, occupation, photo, remarks")
          .in("id", customerIds)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] as CustomerRow[] }),
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
  const payRows = (payRes.data ?? []) as { plot_id: string; amount: number }[];
  if (payRes.error) {
    console.error("[bm/customers] payments error:", payRes.error.message);
    return NextResponse.json({ error: "Could not load customers.", detail: payRes.error.message }, { status: 500 });
  }
  for (const pay of payRows) {
    paidByPlot.set(pay.plot_id, (paidByPlot.get(pay.plot_id) ?? 0) + (pay.amount || 0));
  }
  const discountByBooking = new Map(((bookRes.data ?? []) as { id: string; discount: number }[]).map((b) => [b.id, b.discount ?? 0]));
  const discountBySale = new Map(((saleRes.data ?? []) as { id: string; discount: number }[]).map((s) => [s.id, s.discount ?? 0]));
  const projectById = new Map(((projRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const customers = ((custRes.data ?? []) as CustomerRow[]).map((c) => {
    const cPlots = rows
      .filter((p) => p.customer_id === c.id)
      .map((p) => {
        const paid = paidByPlot.get(p.id) ?? 0;
        let owed = p.total_price ?? 0;
        if (p.sale_id && discountBySale.has(p.sale_id)) owed -= discountBySale.get(p.sale_id)!;
        else if (p.booking_id && discountByBooking.has(p.booking_id)) owed -= discountByBooking.get(p.booking_id)!;
        owed = Math.max(0, owed);
        return {
          id: p.id,
          plotNumber: p.plot_number,
          block: p.block,
          status: p.status,
          projectName: p.project_id ? (projectById.get(p.project_id) ?? null) : null,
          totalPrice: p.total_price ?? 0,
          paid,
          balance: Math.max(0, owed - paid),
          bookingId: p.booking_id,
          saleId: p.sale_id,
        };
      });
    const totalOutstanding = cPlots.reduce((s, p) => s + p.balance, 0);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      alternatePhone: c.alternate_phone,
      email: c.email,
      address: c.address,
      city: c.city,
      state: c.state,
      occupation: c.occupation,
      photo: c.photo,
      remarks: c.remarks,
      totalOutstanding,
      totalPaid: cPlots.reduce((s, p) => s + p.paid, 0),
      plots: cPlots,
    };
  });

  customers.sort((a, b) => b.totalOutstanding - a.totalOutstanding);

  return NextResponse.json(
    { items: customers },
    { headers: { "Cache-Control": "no-store" } },
  );
}
