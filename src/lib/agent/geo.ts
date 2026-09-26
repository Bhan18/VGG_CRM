// Geo helpers — haversine + smart m/km formatting.
// IMPORTANT: We never reveal the geofence radius to the user. On success we
// show no distance at all. When the agent is outside the geofence we show
// their distance from the office in m (<1km) or km (>=1km), without ever
// revealing the threshold itself.

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius, meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format a distance for display to the agent.
 * - null/undefined -> "" (no message)
 * - <1000 m -> "X m"
 * - >=1000 m -> "Y.YZ km"
 * The geofence threshold itself is NEVER displayed.
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !isFinite(meters)) return "";
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

/**
 * Build the "away from office" warning message shown when the agent is
 * outside the geofence. Never reveals the threshold.
 */
export function awayMessage(meters: number | null | undefined): string {
  const d = formatDistance(meters);
  if (!d) return "Unable to confirm your location. Please try again.";
  return `You are ${d} away from the office.`;
}

/**
 * Read the device GPS once. Rejects if geolocation is unavailable or denied.
 * Timeout: 12s. Maximum age: 0 (force fresh reading).
 */
export function readPositionOnce(): Promise<{
  lat: number;
  lng: number;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location services are not available on this device."));
      return;
    }
    const timer = setTimeout(() => {
      reject(new Error("Could not get a location fix. Please check your GPS and try again."));
    }, 12000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 0,
        });
      },
      (err) => {
        clearTimeout(timer);
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Enable it in your browser settings to mark attendance."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Your current location could not be determined. Try moving to an open area."
              : "Location request timed out. Please try again.";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
