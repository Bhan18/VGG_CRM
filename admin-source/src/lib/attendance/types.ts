// Shared types for the attendance admin UI.
// These mirror the API response shapes from /api/attendance/*.

export type AttendanceEmployee = {
  id: string;
  employeeCode: string;
  name: string;
  phone: string;
  department: string;
  role: string;
  profilePhoto: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type AttendanceRecord = {
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
  workingMinutes: number | null;
  status: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE" | "CANCELLED";
  markedBy: string;
  createdAt: string;
  updatedAt: string;
  employee?: AttendanceEmployee;
};

export type AttendanceLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowedRadius: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type AttendanceSettings = {
  id: string;
  officeStartTime: string;
  lateAfterMinutes: number;
  halfDayAfterMinutes: number;
  minimumWorkingMinutes: number;
  requirePhoto: boolean;
  requireLocation: boolean;
  timezone: string;
  updatedAt: string;
};

export type AttendanceAuditLog = {
  id: string;
  adminUserIdentifier: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};

export type Overview = {
  totalStaff: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  onLeave: number;
  byDepartment: Array<{
    department: string;
    total: number;
    present: number;
    late: number;
    absent: number;
  }>;
};

export type ReportRow = {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  workingDays: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  totalWorkingMinutes: number;
};

export type AdminView =
  | "overview"
  | "today"
  | "employees"
  | "history"
  | "reports"
  | "locations"
  | "settings"
  | "audit"
  | "existing-home";

export type ExistingView =
  | "dashboard-home"
  | "attendance";
