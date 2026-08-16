// Agent domain types. Attendance + profile come from the attendance
// Supabase project (via /api/attendance/staff/*). Content + branding come
// from the main Supabase project.

export type AgentTab = "home" | "content" | "profile" | "attendance";
export type AgentContentTab = "posts" | "brochures" | "videos";

// Employee row from attendance_employees, mapped to camelCase
// (matches mapEmployee + the staff/session response).
export interface AgentProfile {
  id: string;
  employeeCode: string;
  name: string;
  phone: string;
  department: string;
  role: string;
  profilePhoto: string | null;
  joiningDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Today's attendance record from the staff/session endpoint.
export interface AgentTodayRecord {
  id: string;
  employeeId: string;
  attendanceDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInPhoto: string | null;
  checkOutPhoto: string | null;
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  checkInLocationId: string | null;
  checkOutLocationId: string | null;
  checkInDistance: number | null;
  checkOutDistance: number | null;
  checkInReason: string | null;
  checkOutReason: string | null;
  workingMinutes: number | null;
  status: string;
  markedBy: string;
  createdAt: string;
  updatedAt: string;
}

// Attendance settings relevant to the agent (from staff/session).
export interface AgentSettings {
  id: string;
  officeStartTime: string;
  officeEndTime: string;
  checkInEarlyWindowMinutes: number;
  checkOutEarlyWindowMinutes: number;
  reasonOptions: string[];
  lateAfterMinutes: number;
  halfDayAfterMinutes: number;
  minimumWorkingMinutes: number;
  requirePhoto: boolean;
  requireLocation: boolean;
  timezone: string;
}

export interface AgentSession {
  employee: AgentProfile;
  isAdmin?: boolean;
  today: AgentTodayRecord | null;
  settings: AgentSettings;
}

// One row per day (attendance_records model).
export interface AttendanceLogEntry {
  id: string;
  attendanceDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  workingMinutes: number | null;
  status: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE" | "CANCELLED";
}

export interface ContentPost {
  id: string;
  title: string;
  body: string | null;
  cover_image_url: string | null;
  attachment_url: string | null;
  published_at: string | null;
  pinned: boolean;
}

export interface ContentBrochure {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  published_at: string | null;
}

export interface ContentVideo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  published_at: string | null;
}

export interface GeoReading {
  lat: number;
  lng: number;
  accuracy: number; // meters
  distanceMeters: number | null; // null if office location not configured
}
