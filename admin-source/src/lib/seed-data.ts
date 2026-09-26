
// ============================================================
// Seed Data: VGG Infra Developers
// Project: Vijaya Sandalwood Farm
// Layout: Phase 1 (with sample plots overlaid on the layout image)
// ============================================================
import type {
  Project,
  Layout,
  Plot,
  Customer,
  Booking,
  Sale,
  Payment,
  User,
  CompanySettings,
  ActivityLog,
} from "./types";

const now = new Date();
const iso = (daysAgo: number) =>
  new Date(now.getTime() - daysAgo * 86400000).toISOString();

export const seedSettings: CompanySettings = {
  companyName: "VGG Infra Developers",
  gst: "29AABCV1234M1Z5",
  address: "No. 42, MG Road, Bengaluru, Karnataka 560001",
  phone: "+91 80 2345 6789",
  email: "info@vgginfra.com",
  bankDetails: {
    bankName: "HDFC Bank",
    accountName: "VGG Infra Developers Pvt Ltd",
    accountNumber: "50200012345678",
    ifsc: "HDFC0001234",
    branch: "MG Road, Bengaluru",
  },
  upi: "vgginfra@hdfcbank",
  paymentGateway: "Razorpay",
};

export const seedUsers: User[] = [
  {
    id: "u1",
    name: "Venkatesh G",
    email: "admin@vgginfra.com",
    password: "admin123",
    role: "administrator",
    active: true,
    createdAt: iso(120),
  },
  {
    id: "u2",
    name: "Priya Sharma",
    email: "priya@vgginfra.com",
    password: "sales123",
    role: "sales_manager",
    active: true,
    createdAt: iso(90),
  },
  {
    id: "u3",
    name: "Arjun Reddy",
    email: "arjun@vgginfra.com",
    password: "market123",
    role: "marketing",
    active: true,
    createdAt: iso(60),
  },
  {
    id: "u4",
    name: "Meena Iyer",
    email: "meena@vgginfra.com",
    password: "view123",
    role: "viewer",
    active: true,
    createdAt: iso(30),
  },
];

export const seedProjects: Project[] = [
  {
    id: "p1",
    name: "Vijaya Sandalwood Farm Phase 1",
    location: "Anekal Taluk, Bengaluru Rural, Karnataka",
    totalArea: "12.5 Acres",
    numberOfPlots: 48,
    status: "active",
    description:
      "Premium sandalwood farm plots with clear titles, gated community, underground electricity, drip irrigation, and 24/7 security. Each plot comes with planted sandalwood saplings and maintenance support.",
    createdAt: iso(180),
    updatedAt: iso(7),
  },
  {
    id: "p2",
    name: "Vijaya Sandalwood Farm Phase 2",
    location: "Anekal Taluk, Bengaluru Rural, Karnataka",
    totalArea: "15 Acres",
    numberOfPlots: 60,
    status: "planned",
    description:
      "Upcoming expansion of the Vijaya Sandalwood Farm project. Larger plots with enhanced amenities including clubhouse, swimming pool, and organic farming zones.",
    createdAt: iso(30),
    updatedAt: iso(5),
  },
];

// Phase 1 layout. No image uploaded yet — we generate a schematic
// placeholder grid so the interactive layout is immediately usable.
// When the user uploads a real master layout image, the same plot
// overlays (x/y/w/h in %) continue to work.
export const seedLayouts: Layout[] = [
  {
    id: "l1",
    projectId: "p1",
    name: "Phase 1",
    description:
      "Initial release of Vijaya Sandalwood Farm. 48 plots arranged in 4 blocks (A, B, C, D) with internal roads and central green space.",
    numberOfPlots: 48,
    createdAt: iso(180),
    updatedAt: iso(7),
  },
  {
    id: "l2",
    projectId: "p2",
    name: "Phase 2 - Master Plan",
    description:
      "Planned Phase 2 layout. Plot numbering and final layout subject to regulatory approval.",
    numberOfPlots: 60,
    createdAt: iso(30),
    updatedAt: iso(5),
  },
];

// Generate 48 plots for Phase 1 laid out as a 4-block grid (A, B, C, D)
// Overlays are in percentage coordinates so they scale with any image.
function generatePhase1Plots(): Plot[] {
  const plots: Plot[] = [];
  const blocks = [
    { id: "A", xStart: 5, yStart: 10 },
    { id: "B", xStart: 55, yStart: 10 },
    { id: "C", xStart: 5, yStart: 55 },
    { id: "D", xStart: 55, yStart: 55 },
  ];
  const facings: Plot["facing"][] = [
    "North",
    "South",
    "East",
    "West",
    "North-East",
    "North-West",
    "South-East",
    "South-West",
  ];
  const cols = 6;
  const rows = 2;
  const cellW = 6.5; // % of image width
  const cellH = 14; // % of image height
  const gapX = 1;
  const gapY = 2;

  let counter = 0;
  for (const block of blocks) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        counter++;
        const plotNumber = String(c + 1 + r * cols);
        const size = 3 + (counter % 3) * 0.5; // 3-4 cents
        const pricePerCent = 25000 + (counter % 4) * 1000;
        const totalPrice = Math.round(size * pricePerCent);
        const status: Plot["status"] = "available";

        plots.push({
          id: `plot-${counter}`,
          layoutId: "l1",
          projectId: "p1",
          plotNumber,
          block: block.id,
          size,
          sizeUnit: "cents",
          facing: facings[counter % facings.length],
          pricePerCent,
          totalPrice,
          status,
          cornerPlot: c === 0 || c === cols - 1,
          roadWidth: 30,
          notes: "",
          x: block.xStart + c * (cellW + gapX),
          y: block.yStart + r * (cellH + gapY),
          width: cellW,
          height: cellH,
          shape: "rect",
          createdAt: iso(180),
          updatedAt: iso(Math.max(1, 30 - counter)),
        });
      }
    }
  }
  return plots;
}

export const seedPlots: Plot[] = generatePhase1Plots();

export const seedCustomers: Customer[] = [];

export const seedBookings: Booking[] = [];

export const seedSales: Sale[] = [];

export const seedPayments: Payment[] = [];

export const seedActivityLogs: ActivityLog[] = [
  {
    id: "al1",
    userId: "u2",
    userName: "Priya Sharma",
    action: "CREATE_SALE",
    entity: "sale",
    entityId: "s1",
    details: "Recorded sale for plot A06",
    timestamp: iso(2),
  },
  {
    id: "al2",
    userId: "u2",
    userName: "Priya Sharma",
    action: "CREATE_BOOKING",
    entity: "booking",
    entityId: "b1",
    details: "Reserved plot A05",
    timestamp: iso(5),
  },
  {
    id: "al3",
    userId: "u1",
    userName: "Venkatesh G",
    action: "UPDATE_PROJECT",
    entity: "project",
    entityId: "p1",
    details: "Updated project description",
    timestamp: iso(7),
  },
  {
    id: "al4",
    userId: "u3",
    userName: "Arjun Reddy",
    action: "CREATE_CUSTOMER",
    entity: "customer",
    entityId: "c44",
    details: "Added new customer Sneha Patil",
    timestamp: iso(3),
  },
  {
    id: "al5",
    userId: "u2",
    userName: "Priya Sharma",
    action: "RECEIVE_PAYMENT",
    entity: "payment",
    entityId: "pay-s-1",
    details: "Received RTGS payment of ₹9,80,000",
    timestamp: iso(1),
  },
];


