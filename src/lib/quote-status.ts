export function quoteStatus(
  quote: { state: string; expires_at: string },
  revision: boolean,
  now: number,
) {
  if (quote.state === "accepted") return "Accepted";
  if (revision) return "Revision requested";
  if (quote.state === "superseded") return "Replaced by a newer quote";
  return Date.parse(quote.expires_at) <= now ? "Expired" : "Awaiting your decision";
}
