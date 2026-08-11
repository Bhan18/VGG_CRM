/**
 * GPS / Geolocation helpers for attendance verification.
 *
 * Haversine distance + a simple "find nearest permitted location"
 * helper used by the attendance service when staff marks attendance.
 */

export type LatLng = { latitude: number; longitude: number };

export type PermittedLocation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowedRadius: number; // metres
};

/**
 * Haversine great-circle distance in metres.
 */
export function haversineDistance(
  a: LatLng,
  b: LatLng,
): number {
  const R = 6371000; // metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c);
}

export type LocationCheckResult =
  | {
      ok: true;
      location: PermittedLocation;
      distance: number;
    }
  | {
      ok: false;
      reason: "no_location" | "outside" | "no_permitted_locations";
      nearestLocation?: PermittedLocation;
      distance?: number;
    };

/**
 * Verify a GPS coordinate is inside any of the permitted locations.
 * Returns the matched location (if inside) or the nearest one with the
 * distance for diagnostic messaging.
 */
export function verifyAttendanceLocation(
  gps: LatLng | null | undefined,
  permitted: PermittedLocation[],
): LocationCheckResult {
  if (!gps) {
    return { ok: false, reason: "no_location" };
  }
  if (permitted.length === 0) {
    return { ok: false, reason: "no_permitted_locations" };
  }

  let best: { loc: PermittedLocation; dist: number } | null = null;
  for (const loc of permitted) {
    const dist = haversineDistance(gps, {
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
    if (!best || dist < best.dist) {
      best = { loc, dist };
    }
    if (dist <= loc.allowedRadius) {
      return { ok: true, location: loc, distance: dist };
    }
  }

  return {
    ok: false,
    reason: "outside",
    nearestLocation: best!.loc,
    distance: best!.dist,
  };
}
