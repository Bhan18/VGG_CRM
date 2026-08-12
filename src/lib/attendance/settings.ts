/**
 * Settings helper — single-row table in Supabase.
 * Returns sensible defaults if no row exists yet (and lazily creates one).
 */

import { getAttendanceAdminClient } from "./client";
import { unwrapSingle, unwrapNullable } from "./supabase-helpers";

const DEFAULT_REASON_OPTIONS = [
  "Traffic",
  "Personal work",
  "Emergency",
  "Family issue",
  "Travel",
  "Other",
];

const DEFAULTS = {
  officeStartTime: "09:00",
  officeEndTime: "18:00",
  checkInEarlyWindowMinutes: 45,
  checkOutEarlyWindowMinutes: 180,
  reasonOptions: DEFAULT_REASON_OPTIONS,
  lateAfterMinutes: 15,
  halfDayAfterMinutes: 120,
  minimumWorkingMinutes: 480,
  requirePhoto: true,
  requireLocation: true,
  timezone: "Asia/Kolkata",
};

export type AttendanceSettingsRow = {
  id: string;
  office_start_time: string;
  office_end_time: string;
  check_in_early_window_minutes: number;
  check_out_early_window_minutes: number;
  reason_options: string[];
  late_after_minutes: number;
  half_day_after_minutes: number;
  minimum_working_minutes: number;
  require_photo: boolean;
  require_location: boolean;
  timezone: string;
  updated_at: string;
};

export async function getSettings(): Promise<AttendanceSettingsRow> {
  const supabase = getAttendanceAdminClient();
  let row = await unwrapNullable<AttendanceSettingsRow>(
    supabase
      .from("attendance_settings")
      .select("*")
      .eq("id", "singleton")
      .single(),
  );
  if (!row) {
    row = await unwrapSingle<AttendanceSettingsRow>(
      supabase
        .from("attendance_settings")
        .insert({
          id: "singleton",
          office_start_time: DEFAULTS.officeStartTime,
          office_end_time: DEFAULTS.officeEndTime,
          check_in_early_window_minutes: DEFAULTS.checkInEarlyWindowMinutes,
          check_out_early_window_minutes: DEFAULTS.checkOutEarlyWindowMinutes,
          reason_options: DEFAULTS.reasonOptions,
          late_after_minutes: DEFAULTS.lateAfterMinutes,
          half_day_after_minutes: DEFAULTS.halfDayAfterMinutes,
          minimum_working_minutes: DEFAULTS.minimumWorkingMinutes,
          require_photo: DEFAULTS.requirePhoto,
          require_location: DEFAULTS.requireLocation,
          timezone: DEFAULTS.timezone,
        })
        .select()
        .single(),
    );
  }
  return row;
}

export async function updateSettings(
  data: Partial<typeof DEFAULTS>,
): Promise<AttendanceSettingsRow> {
  const supabase = getAttendanceAdminClient();
  const existing = await getSettings();

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (data.officeStartTime !== undefined)
    update.office_start_time = data.officeStartTime;
  if (data.officeEndTime !== undefined)
    update.office_end_time = data.officeEndTime;
  if (data.checkInEarlyWindowMinutes !== undefined)
    update.check_in_early_window_minutes = data.checkInEarlyWindowMinutes;
  if (data.checkOutEarlyWindowMinutes !== undefined)
    update.check_out_early_window_minutes = data.checkOutEarlyWindowMinutes;
  if (data.reasonOptions !== undefined)
    update.reason_options = Array.isArray(data.reasonOptions)
      ? data.reasonOptions
      : [];
  if (data.lateAfterMinutes !== undefined)
    update.late_after_minutes = data.lateAfterMinutes;
  if (data.halfDayAfterMinutes !== undefined)
    update.half_day_after_minutes = data.halfDayAfterMinutes;
  if (data.minimumWorkingMinutes !== undefined)
    update.minimum_working_minutes = data.minimumWorkingMinutes;
  if (data.requirePhoto !== undefined) update.require_photo = data.requirePhoto;
  if (data.requireLocation !== undefined)
    update.require_location = data.requireLocation;
  if (data.timezone !== undefined) update.timezone = data.timezone;

  return unwrapSingle<AttendanceSettingsRow>(
    supabase
      .from("attendance_settings")
      .update(update)
      .eq("id", "singleton")
      .select()
      .single(),
  );
}

/**
 * Compute attendance status based on settings + check-in/out times.
 */
export async function computeStatus(opts: {
  checkInTime: Date;
  checkOutTime?: Date | null;
}): Promise<"PRESENT" | "LATE" | "HALF_DAY"> {
  const s = await getSettings();
  const [oh, om] = s.office_start_time.split(":").map(Number);
  const checkIn = new Date(opts.checkInTime);
  const officeStart = new Date(checkIn);
  officeStart.setHours(oh, om, 0, 0);

  const lateMs = s.late_after_minutes * 60 * 1000;
  const halfDayMs = s.half_day_after_minutes * 60 * 1000;
  const minWorkMs = s.minimum_working_minutes * 60 * 1000;

  const checkOut = opts.checkOutTime ? new Date(opts.checkOutTime) : null;
  const workedMs = checkOut ? checkOut.getTime() - checkIn.getTime() : 0;

  if (checkIn.getTime() - officeStart.getTime() >= halfDayMs) {
    return "HALF_DAY";
  }
  if (workedMs > 0 && workedMs < minWorkMs) {
    return "HALF_DAY";
  }
  if (checkIn.getTime() - officeStart.getTime() > lateMs) {
    return "LATE";
  }
  return "PRESENT";
}
