
// ============================================================
// Supabase Data Access Layer
// All CRUD operations against Supabase, with proper typing.
// Replaces the localStorage-based Zustand store.
// ============================================================
import { supabase } from "./supabase-client";
import type {
  Project, Layout, Plot, Customer, Booking, Sale, Payment,
  User, CompanySettings, ActivityLog, PlotStatus, BlockConfig,
} from "./types";
import { generateReferenceCode, toCents } from "./store-legacy";

// ---------- Projects ----------
export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapProject);
}

export async function createProject(p: Omit<Project, "id" | "createdAt" | "updatedAt">): Promise<Project> {
  const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase.from("projects").insert({
    id, name: p.name, location: p.location, total_area: p.totalArea,
    number_of_plots: p.numberOfPlots, layout_image: p.layoutImage, status: p.status,
    description: p.description,
  }).select().single();
  if (error) throw error;
  return mapProject(data);
}

export async function createProjectWithBlocks(
  p: Omit<Project, "id" | "createdAt" | "updatedAt">,
  blocks: BlockConfig[],
  layoutName = "Phase 1",
): Promise<string> {
  const projectId = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const layoutId = `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  // 1. Create project
  const { error: pe } = await supabase.from("projects").insert({
    id: projectId, name: p.name, location: p.location, total_area: p.totalArea,
    number_of_plots: 0, layout_image: p.layoutImage, status: p.status, description: p.description,
  });
  if (pe) throw pe;

  // 2. Create layout
  const { error: le } = await supabase.from("layouts").insert({
    id: layoutId, project_id: projectId, name: layoutName,
    description: `Auto-generated layout for ${p.name}. Contains ${blocks.length} block(s).`,
    number_of_plots: 0,
  });
  if (le) throw le;

  // 3. Generate plots
  const blockCount = blocks.length;
  const cols = blockCount <= 1 ? 1 : blockCount <= 4 ? 2 : 3;
  const rows = Math.ceil(blockCount / cols);
  const margin = 3, gap = 3;
  const blockW = (100 - margin * 2 - (cols - 1) * gap) / cols;
  const blockH = (100 - margin * 2 - (rows - 1) * gap) / rows;
  const titleAreaH = 4;
  const plotRows: Record<string, unknown>[] = [];

  blocks.forEach((block, blockIdx) => {
    const col = blockIdx % cols;
    const row = Math.floor(blockIdx / cols);
    const blockX = margin + col * (blockW + gap);
    const blockY = margin + row * (blockH + gap);
    const plotNums = parsePlotRange(block.plotRange);
    const cornerNums = parsePlotRange(block.cornerPlots);
    const plotCols = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(plotNums.length * 1.4))));
    const pRows = Math.ceil(plotNums.length / plotCols);
    const innerW = blockW - 2;
    const innerH = blockH - titleAreaH - 2;
    const plotW = (innerW - (plotCols - 1) * 0.4) / plotCols;
    const plotH = (innerH - (pRows - 1) * 0.4) / pRows;

    plotNums.forEach((num, i) => {
      const pCol = i % plotCols;
      const pRow = Math.floor(i / plotCols);
      const plotFacing = block.facingAssignments?.[num] ?? block.defaultFacing;
      const plotSize = block.sizeOverrides?.[num] ?? block.defaultSize;
      const basePricePerCent = block.priceOverrides?.[num] ?? block.defaultPricePerCent;
      const isCorner = cornerNums.includes(num);
      const facingPremium = block.facingPremiums?.[plotFacing] ?? 0;
      const cornerPremium = isCorner ? (block.cornerPremium ?? 0) : 0;
      const effectivePricePerCent = basePricePerCent + facingPremium + cornerPremium;
      const centsSize = toCents(plotSize, block.areaUnit);
      const totalPrice = Math.round(centsSize * effectivePricePerCent);
      const plotId = `plot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      plotRows.push({
        id: plotId, layout_id: layoutId, project_id: projectId,
        plot_number: String(num), block: block.name,
        size: plotSize, size_unit: block.areaUnit, facing: plotFacing,
        price_per_cent: effectivePricePerCent, total_price: totalPrice,
        status: "available", corner_plot: isCorner, road_width: block.roadWidth,
        notes: "", x: blockX + 1 + pCol * (plotW + 0.4),
        y: blockY + titleAreaH + pRow * (plotH + 0.4),
        width: plotW, height: plotH,
      });
    });
  });

  // 4. Insert plots in batches
  const batchSize = 100;
  for (let i = 0; i < plotRows.length; i += batchSize) {
    const batch = plotRows.slice(i, i + batchSize);
    const { error: ple } = await supabase.from("plots").insert(batch);
    if (ple) throw ple;
  }

  // 5. Update counts
  await supabase.from("layouts").update({ number_of_plots: plotRows.length }).eq("id", layoutId);
  await supabase.from("projects").update({ number_of_plots: plotRows.length }).eq("id", projectId);

  return projectId;
}

// ---------- Layouts ----------
export async function fetchLayouts(): Promise<Layout[]> {
  const { data, error } = await supabase.from("layouts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapLayout);
}

// ---------- Plots ----------
export async function fetchPlots(): Promise<Plot[]> {
  const { data, error } = await supabase.from("plots").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapPlot);
}

export async function updatePlot(id: string, patch: Partial<Plot>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.plotNumber !== undefined) update.plot_number = patch.plotNumber;
  if (patch.block !== undefined) update.block = patch.block;
  if (patch.size !== undefined) update.size = patch.size;
  if (patch.sizeUnit !== undefined) update.size_unit = patch.sizeUnit;
  if (patch.facing !== undefined) update.facing = patch.facing;
  if (patch.pricePerCent !== undefined) update.price_per_cent = patch.pricePerCent;
  if (patch.totalPrice !== undefined) update.total_price = patch.totalPrice;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.cornerPlot !== undefined) update.corner_plot = patch.cornerPlot;
  if (patch.roadWidth !== undefined) update.road_width = patch.roadWidth;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.customerId !== undefined) update.customer_id = patch.customerId;
  if (patch.bookingId !== undefined) update.booking_id = patch.bookingId;
  if (patch.saleId !== undefined) update.sale_id = patch.saleId;

  const { error } = await supabase.from("plots").update(update).eq("id", id);
  if (error) throw error;
}

export async function setPlotStatus(id: string, status: PlotStatus, customerId?: string, bookingId?: string, saleId?: string): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (customerId !== undefined) update.customer_id = customerId;
  if (bookingId !== undefined) update.booking_id = bookingId;
  if (saleId !== undefined) update.sale_id = saleId;
  const { error } = await supabase.from("plots").update(update).eq("id", id);
  if (error) throw error;
}

// ---------- Customers ----------
export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapCustomer);
}

export async function createCustomer(c: Omit<Customer, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.from("customers").insert({
    id, name: c.name, father_name: c.fatherName, mother_name: c.motherName,
    phone: c.phone, alternate_phone: c.alternatePhone, email: c.email,
    address: c.address, city: c.city, state: c.state, pin_code: c.pinCode,
    occupation: c.occupation, pan: c.pan, aadhaar: c.aadhaar,
    photo: c.photo, remarks: c.remarks,
  });
  if (error) throw error;
  return id;
}

export async function updateCustomer(id: string, patch: Partial<Customer>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.fatherName !== undefined) update.father_name = patch.fatherName;
  if (patch.motherName !== undefined) update.mother_name = patch.motherName;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.alternatePhone !== undefined) update.alternate_phone = patch.alternatePhone;
  if (patch.email !== undefined) update.email = patch.email;
  if (patch.address !== undefined) update.address = patch.address;
  if (patch.city !== undefined) update.city = patch.city;
  if (patch.state !== undefined) update.state = patch.state;
  if (patch.pinCode !== undefined) update.pin_code = patch.pinCode;
  if (patch.occupation !== undefined) update.occupation = patch.occupation;
  if (patch.pan !== undefined) update.pan = patch.pan;
  if (patch.aadhaar !== undefined) update.aadhaar = patch.aadhaar;
  if (patch.photo !== undefined) update.photo = patch.photo;
  if (patch.remarks !== undefined) update.remarks = patch.remarks;
  const { error } = await supabase.from("customers").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Bookings ----------
export async function fetchBookings(): Promise<Booking[]> {
  const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapBooking);
}

// ---------- Sales ----------
export async function fetchSales(): Promise<Sale[]> {
  const { data, error } = await supabase.from("sales").select("*").order("sale_date", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapSale);
}

// ---------- Payments ----------
export async function fetchPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from("payments").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapPayment);
}

export async function createPayment(p: Omit<Payment, "id" | "createdAt">): Promise<string> {
  const id = `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.from("payments").insert({
    id, plot_id: p.plotId, customer_id: p.customerId, booking_id: p.bookingId, sale_id: p.saleId,
    date: p.date, amount: p.amount, payment_mode: p.paymentMode,
    reference_number: p.referenceNumber, bank: p.bank, cheque_number: p.chequeNumber,
    transaction_id: p.transactionId, remarks: p.remarks,
  });
  if (error) throw error;
  return id;
}

// ---------- Settings ----------
export async function fetchSettings(): Promise<CompanySettings> {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return mapSettings(data);
}

export async function updateSettings(patch: Partial<CompanySettings>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.companyName !== undefined) update.company_name = patch.companyName;
  if (patch.companyLogo !== undefined) update.company_logo = patch.companyLogo;
  if (patch.gst !== undefined) update.gst = patch.gst;
  if (patch.address !== undefined) update.address = patch.address;
  if (patch.phone !== undefined) update.phone = patch.phone;
  if (patch.email !== undefined) update.email = patch.email;
  if (patch.bankDetails) {
    if (patch.bankDetails.bankName !== undefined) update.bank_name = patch.bankDetails.bankName;
    if (patch.bankDetails.accountName !== undefined) update.account_name = patch.bankDetails.accountName;
    if (patch.bankDetails.accountNumber !== undefined) update.account_number = patch.bankDetails.accountNumber;
    if (patch.bankDetails.ifsc !== undefined) update.ifsc = patch.bankDetails.ifsc;
    if (patch.bankDetails.branch !== undefined) update.branch = patch.bankDetails.branch;
  }
  if (patch.upi !== undefined) update.upi = patch.upi;
  if (patch.paymentGateway !== undefined) update.payment_gateway = patch.paymentGateway;
  const { error } = await supabase.from("settings").update(update).eq("id", 1);
  if (error) throw error;
}

// ---------- Activity Logs ----------
export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  const { data, error } = await supabase.from("activity_logs").select("*").order("timestamp", { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).map(mapActivityLog);
}

export async function logActivity(action: string, entity: string, entityId: string, details?: string, userId?: string, userName?: string): Promise<void> {
  const id = `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.from("activity_logs").insert({
    id, user_id: userId, user_name: userName, action, entity, entity_id: entityId, details,
  });
  if (error) console.error("Failed to log activity:", error);
}

// ---------- User Profiles ----------
export async function fetchUserProfiles(): Promise<User[]> {
  const { data, error } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapUserProfile);
}

export async function updateUserProfile(id: string, patch: Partial<User>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.role !== undefined) update.role = patch.role;
  if (patch.active !== undefined) update.active = patch.active;
  const { error } = await supabase.from("user_profiles").update(update).eq("id", id);
  if (error) throw error;
}

// ============================================================
// Mappers: DB row → TypeScript interface
// ============================================================
function mapProject(r: Record<string, unknown>): Project {
  return {
    id: r.id, name: r.name, location: r.location, totalArea: r.total_area,
    numberOfPlots: r.number_of_plots, layoutImage: r.layout_image, status: r.status,
    description: r.description, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapLayout(r: Record<string, unknown>): Layout {
  return {
    id: r.id, projectId: r.project_id, name: r.name, image: r.image,
    description: r.description, numberOfPlots: r.number_of_plots,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapPlot(r: Record<string, unknown>): Plot {
  return {
    id: r.id, layoutId: r.layout_id, projectId: r.project_id, plotNumber: r.plot_number,
    block: r.block, size: r.size, sizeUnit: r.size_unit, facing: r.facing,
    pricePerCent: r.price_per_cent, totalPrice: r.total_price, status: r.status,
    cornerPlot: r.corner_plot, roadWidth: r.road_width, notes: r.notes,
    x: r.x, y: r.y, width: r.width, height: r.height,
    customerId: r.customer_id, bookingId: r.booking_id, saleId: r.sale_id,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapCustomer(r: Record<string, unknown>): Customer {
  return {
    id: r.id, name: r.name, fatherName: r.father_name, motherName: r.mother_name,
    phone: r.phone, alternatePhone: r.alternate_phone, email: r.email,
    address: r.address, city: r.city, state: r.state, pinCode: r.pin_code,
    occupation: r.occupation, pan: r.pan, aadhaar: r.aadhaar, photo: r.photo,
    remarks: r.remarks, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapBooking(r: Record<string, unknown>): Booking {
  return {
    id: r.id, plotId: r.plot_id, customerId: r.customer_id, referenceCode: r.reference_code,
    bookingDate: r.booking_date, advancePaid: r.advance_paid, paymentMethod: r.payment_method,
    expectedRegistrationDate: r.expected_registration_date, bookingExpiry: r.booking_expiry,
    status: r.status, remarks: r.remarks, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapSale(r: Record<string, unknown>): Sale {
  return {
    id: r.id, plotId: r.plot_id, customerId: r.customer_id, referenceCode: r.reference_code,
    saleDate: r.sale_date, registrationNumber: r.registration_number, saleAmount: r.sale_amount,
    discount: r.discount, registrationOffice: r.registration_office, executiveName: r.executive_name,
    paymentMethod: r.payment_method, balanceAmount: r.balance_amount, remarks: r.remarks,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapPayment(r: Record<string, unknown>): Payment {
  return {
    id: r.id, plotId: r.plot_id, customerId: r.customer_id, bookingId: r.booking_id,
    saleId: r.sale_id, date: r.date, amount: r.amount, paymentMode: r.payment_mode,
    referenceNumber: r.reference_number, bank: r.bank, chequeNumber: r.cheque_number,
    transactionId: r.transaction_id, remarks: r.remarks, createdAt: r.created_at,
  };
}
function mapSettings(r: Record<string, unknown>): CompanySettings {
  return {
    companyName: r.company_name, companyLogo: r.company_logo, gst: r.gst,
    address: r.address, phone: r.phone, email: r.email,
    bankDetails: {
      bankName: r.bank_name, accountName: r.account_name, accountNumber: r.account_number,
      ifsc: r.ifsc, branch: r.branch,
    },
    upi: r.upi, paymentGateway: r.payment_gateway,
  };
}
function mapActivityLog(r: Record<string, unknown>): ActivityLog {
  return {
    id: r.id, userId: r.user_id, userName: r.user_name, action: r.action,
    entity: r.entity, entityId: r.entity_id, details: r.details, timestamp: r.timestamp,
  };
}
function mapUserProfile(r: Record<string, unknown>): User {
  return {
    id: r.id, name: r.name, email: r.email, role: r.role, active: r.active,
    createdAt: r.created_at,
  };
}

// Parse a plot range string like "1-10, 12, 15" into [1,2,3,...,10,12,15]
function parsePlotRange(range: string): number[] {
  if (!range) return [];
  const parts = range.split(",").map((s) => s.trim()).filter(Boolean);
  const result: number[] = [];
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((s) => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          result.push(i);
        }
      }
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n)) result.push(n);
    }
  }
  return [...new Set(result)].sort((a, b) => a - b);
}


