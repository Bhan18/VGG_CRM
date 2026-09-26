
// ============================================================
// Content table configurations
// Field definitions for the 13 public website content tables.
// Used by WebsiteContentPage to render the appropriate form + table.
// ============================================================

export type FieldType = "text" | "textarea" | "number" | "boolean" | "select" | "image" | "date" | "url";

export interface FieldConfig {
  key: string;          // snake_case column name (matches Supabase)
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
  default?: unknown;
  hideInTable?: boolean;
  fullWidth?: boolean;
}

export interface ContentTableConfig {
  id: string;           // tab id, e.g. "hero-banners"
  table: string;        // Supabase table name
  title: string;        // plural, e.g. "Hero Banners"
  singular: string;     // e.g. "Hero Banner"
  description: string;
  fields: FieldConfig[];
  hasActiveToggle?: boolean;
}

// All 13 content tables — shown as tabs on a single page
export const CONTENT_TABLES: ContentTableConfig[] = [
  {
    id: "hero-banners",
    table: "hero_banners",
    title: "Hero Banners",
    singular: "Hero Banner",
    description: "Homepage slider images with title, subtitle, and call-to-action button.",
    hasActiveToggle: true,
    fields: [
      { key: "title", label: "Title", type: "text", required: true, placeholder: "Own a Piece of Nature", fullWidth: true },
      { key: "subtitle", label: "Subtitle", type: "text", placeholder: "Premium Farmland Plots Near Bengaluru", fullWidth: true },
      { key: "image", label: "Image URL", type: "image", required: true, helpText: "Recommended: 1920×1080px landscape", fullWidth: true },
      { key: "cta_text", label: "CTA Text", type: "text", placeholder: "Explore Projects" },
      { key: "cta_link", label: "CTA Link", type: "text", placeholder: "#projects" },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
      { key: "active", label: "Active", type: "boolean", default: true, hideInTable: true },
    ],
  },
  {
    id: "gallery",
    table: "gallery_images",
    title: "Gallery",
    singular: "Gallery Image",
    description: "Photo gallery shown on the homepage with masonry layout and lightbox.",
    fields: [
      { key: "title", label: "Title", type: "text", placeholder: "Entrance Gateway" },
      { key: "image", label: "Image URL", type: "image", required: true, fullWidth: true },
      { key: "category", label: "Category", type: "text", placeholder: "Project / Infrastructure / Nature" },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
  {
    id: "amenities",
    table: "amenities",
    title: "Amenities",
    singular: "Amenity",
    description: "Amenity icons shown on the homepage Amenities section.",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, placeholder: "Gated Community" },
      { key: "description", label: "Description", type: "textarea", fullWidth: true },
      {
        key: "icon", label: "Icon", type: "select",
        options: [
          { value: "shield", label: "Shield" }, { value: "road", label: "Road" },
          { value: "zap", label: "Zap (Electricity)" }, { value: "droplet", label: "Droplet (Water)" },
          { value: "spray", label: "Spray (Irrigation)" }, { value: "home", label: "Home" },
          { value: "smile", label: "Smile (Play Area)" }, { value: "activity", label: "Activity (Jogging)" },
          { value: "check", label: "Check (Approved)" }, { value: "sprout", label: "Sprout (Organic)" },
        ],
        default: "check",
      },
      { key: "image", label: "Image URL (optional)", type: "image", fullWidth: true },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
  {
    id: "testimonials",
    table: "testimonials",
    title: "Testimonials",
    singular: "Testimonial",
    description: "Customer reviews shown in the homepage Testimonials carousel.",
    fields: [
      { key: "name", label: "Customer Name", type: "text", required: true, placeholder: "Rajesh Kumar" },
      { key: "role", label: "Role / Location", type: "text", placeholder: "Software Engineer, Bengaluru" },
      { key: "photo", label: "Photo URL", type: "image" },
      { key: "rating", label: "Rating (1-5)", type: "number", default: 5, required: true },
      { key: "text", label: "Testimonial Text", type: "textarea", required: true, fullWidth: true },
      { key: "video_url", label: "Video URL (optional)", type: "url", fullWidth: true },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
  {
    id: "faqs",
    table: "faqs",
    title: "FAQs",
    singular: "FAQ",
    description: "Frequently asked questions shown in the homepage FAQ accordion.",
    fields: [
      { key: "question", label: "Question", type: "text", required: true, fullWidth: true },
      { key: "answer", label: "Answer", type: "textarea", required: true, fullWidth: true },
      { key: "category", label: "Category", type: "text", placeholder: "Legal / Payment / Visit / Amenities" },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
  {
    id: "team",
    table: "team_members",
    title: "Team Members",
    singular: "Team Member",
    description: "People shown in the homepage Team section.",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "role", label: "Role", type: "text", placeholder: "Founder & MD" },
      { key: "photo", label: "Photo URL", type: "image" },
      { key: "bio", label: "Bio", type: "textarea", fullWidth: true },
      { key: "phone", label: "Phone", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "linkedin", label: "LinkedIn URL", type: "url", fullWidth: true },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
  {
    id: "offers",
    table: "offers",
    title: "Offers",
    singular: "Offer",
    description: "Limited-time offers shown on the homepage Offers section.",
    hasActiveToggle: true,
    fields: [
      { key: "title", label: "Title", type: "text", required: true, fullWidth: true },
      { key: "description", label: "Description", type: "textarea", fullWidth: true },
      { key: "image", label: "Image URL", type: "image", fullWidth: true },
      { key: "valid_until", label: "Valid Until", type: "date" },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
      { key: "active", label: "Active", type: "boolean", default: true, hideInTable: true },
    ],
  },
  {
    id: "brochures",
    table: "brochures",
    title: "Brochures",
    singular: "Brochure",
    description: "PDF brochures and price lists shown in project detail downloads.",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, placeholder: "Vijaya Sandalwood Farm — Brochure", fullWidth: true },
      { key: "file_url", label: "PDF URL", type: "url", required: true, fullWidth: true, helpText: "Upload to Supabase Storage and paste the public URL" },
      { key: "project_id", label: "Project ID (optional)", type: "text", helpText: "Leave empty to show on all projects" },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
  {
    id: "news",
    table: "news",
    title: "News & Updates",
    singular: "News Item",
    description: "News articles and announcements shown on the homepage News section.",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, fullWidth: true },
      { key: "content", label: "Content", type: "textarea", fullWidth: true },
      { key: "image", label: "Image URL", type: "image", fullWidth: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "link", label: "External Link (optional)", type: "url", fullWidth: true },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
  {
    id: "nearby-places",
    table: "nearby_places",
    title: "Nearby Places",
    singular: "Nearby Place",
    description: "Places shown in the homepage Location section.",
    fields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Kempegowda International Airport" },
      { key: "type", label: "Type", type: "text", placeholder: "Airport / Town / Hospital / School" },
      { key: "distance_km", label: "Distance (km)", type: "number" },
      { key: "travel_minutes", label: "Travel Time (min)", type: "number" },
      {
        key: "icon", label: "Icon", type: "select",
        options: [
          { value: "plane", label: "Plane" }, { value: "building", label: "Building" },
          { value: "bus", label: "Bus" }, { value: "heart", label: "Heart (Hospital)" },
          { value: "book", label: "Book (School)" },
        ],
        default: "building",
      },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
  {
    id: "videos",
    table: "videos",
    title: "Videos",
    singular: "Video",
    description: "Video tours shown in the homepage Videos section.",
    fields: [
      { key: "title", label: "Title", type: "text", required: true, fullWidth: true },
      { key: "url", label: "Embed URL", type: "url", required: true, fullWidth: true, helpText: "YouTube embed URL like https://www.youtube.com/embed/VIDEO_ID" },
      { key: "thumbnail", label: "Thumbnail URL", type: "image", fullWidth: true },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
  {
    id: "stats",
    table: "company_stats",
    title: "Company Stats",
    singular: "Stat",
    description: "Animated counters shown in the homepage About section.",
    fields: [
      { key: "label", label: "Label", type: "text", required: true, placeholder: "Acres Developed" },
      { key: "value", label: "Value", type: "number", required: true },
      { key: "suffix", label: "Suffix", type: "text", placeholder: "+ / %" },
      {
        key: "icon", label: "Icon", type: "select",
        options: [
          { value: "trees", label: "Trees" }, { value: "users", label: "Users" },
          { value: "award", label: "Award" }, { value: "check", label: "Check" },
          { value: "sprout", label: "Sprout" },
        ],
        default: "award",
      },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
  {
    id: "timeline",
    table: "timeline_events",
    title: "Timeline",
    singular: "Timeline Event",
    description: "Milestones shown in the homepage About section timeline.",
    fields: [
      { key: "year", label: "Year", type: "text", required: true, placeholder: "2010" },
      { key: "title", label: "Title", type: "text", required: true, fullWidth: true },
      { key: "description", label: "Description", type: "textarea", fullWidth: true },
      { key: "order", label: "Order", type: "number", default: 0, hideInTable: true },
    ],
  },
];

