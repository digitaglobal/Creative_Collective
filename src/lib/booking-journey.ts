/** Only allow local booking destinations; never redirect to an arbitrary URL. */
export function bookingReturnTo(value: unknown): string {
  if (typeof value !== "string" || /[\\\r\n]/.test(value)) return "/account/bookings";
  try {
    const url = new URL(value, "https://booking.local");
    if (url.origin !== "https://booking.local") return "/account/bookings";
    if (!["/checkout", "/confirmation", "/account/bookings"].includes(url.pathname))
      return "/account/bookings";
    return url.pathname + url.search;
  } catch {
    return "/account/bookings";
  }
}
