import { NextRequest, NextResponse } from "next/server";
import { getCrmSupabase, getStaffFromCrmRequest } from "@/lib/crm/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const staff = await getStaffFromCrmRequest(req as unknown as Request);
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return NextResponse.json({ plots: [], customers: [], projects: [] });

    const sb = getCrmSupabase();
    const safeQ = q.replace(/%/g, "").replace(/,/g, "");

    // Search plots by plot_number / block
    const plotsPromise = sb
      .from("plots")
      .select("id, plot_number, block, status, size, size_unit, total_price, price_per_cent, project_id, customer_id, booking_id, sale_id")
      .or(`plot_number.ilike.%${safeQ}%,block.ilike.%${safeQ}%`)
      .limit(20);

    // Also search customers by name / phone
    const customersPromise = sb
      .from("customers")
      .select("id, name, phone, email, father_name")
      .or(`name.ilike.%${safeQ}%,phone.ilike.%${safeQ}%`)
      .limit(20);

    // If q looks like project prefix, also search projects
    const projectsPromise = sb
      .from("projects")
      .select("id, name, location")
      .ilike("name", `%${safeQ}%`)
      .limit(10);

    const [plotsRes, customersRes, projectsRes] = await Promise.all([plotsPromise, customersPromise, projectsPromise]);

    if (plotsRes.error) throw plotsRes.error;
    if (customersRes.error) throw customersRes.error;

    // Enrich plots with project name + customer name where available
    const plots = plotsRes.data ?? [];
    const plotProjectIds = [...new Set(plots.map((p: any) => p.project_id).filter(Boolean))];
    let projectMap: Record<string, any> = {};
    if (plotProjectIds.length > 0) {
      const { data: projData } = await sb.from("projects").select("id, name").in("id", plotProjectIds);
      (projData ?? []).forEach((pr: any) => (projectMap[pr.id] = pr));
    }
    const plotCustomerIds = [...new Set(plots.map((p: any) => p.customer_id).filter(Boolean))];
    let customerMap: Record<string, any> = {};
    if (plotCustomerIds.length > 0) {
      const { data: custData } = await sb.from("customers").select("id, name, phone").in("id", plotCustomerIds);
      (custData ?? []).forEach((c: any) => (customerMap[c.id] = c));
    }

    const enrichedPlots = plots.map((p: any) => ({
      id: p.id,
      plotNumber: p.plot_number,
      block: p.block,
      status: p.status,
      size: p.size,
      sizeUnit: p.size_unit,
      totalPrice: p.total_price,
      pricePerCent: p.price_per_cent,
      projectId: p.project_id,
      projectName: projectMap[p.project_id]?.name ?? null,
      customerId: p.customer_id,
      customerName: p.customer_id ? (customerMap[p.customer_id]?.name ?? null) : null,
      customerPhone: p.customer_id ? (customerMap[p.customer_id]?.phone ?? null) : null,
      bookingId: p.booking_id,
      saleId: p.sale_id,
    }));

    // If no plots matched but customers did, also fetch up to 5 plots per customer (their booked plots)
    let customerPlots: any[] = [];
    if (enrichedPlots.length === 0 && customersRes.data && customersRes.data.length > 0) {
      const ids = customersRes.data.map((c: any) => c.id).slice(0, 5);
      const { data: cPlots } = await sb.from("plots").select("id, plot_number, block, status, project_id, customer_id").in("customer_id", ids).limit(20);
      if (cPlots) {
        const projIds2 = [...new Set(cPlots.map((p: any) => p.project_id))];
        let pm2: Record<string, any> = {};
        if (projIds2.length) {
          const { data: pd } = await sb.from("projects").select("id, name").in("id", projIds2);
          (pd ?? []).forEach((pr: any) => (pm2[pr.id] = pr));
        }
        customerPlots = cPlots.map((p: any) => ({
          id: p.id,
          plotNumber: p.plot_number,
          block: p.block,
          status: p.status,
          projectId: p.project_id,
          projectName: pm2[p.project_id]?.name ?? null,
          customerId: p.customer_id,
        }));
      }
    }

    return NextResponse.json({
      plots: enrichedPlots,
      customerPlots,
      customers: (customersRes.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        fatherName: c.father_name,
      })),
      projects: (projectsRes.data ?? []).map((pr: any) => ({ id: pr.id, name: pr.name, location: pr.location })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[crm/search] error:", err);
    const msg = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
