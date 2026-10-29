import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/lib/supabase";

type Funnel = {
  device: string;
  space_viewed: number;
  time_selected: number;
  checkout_started: number;
  request_submitted: number;
  confirmed: number;
  cancelled: number;
  expired: number;
};
export function BookingFunnel() {
  const query = useQuery({
    queryKey: ["booking-funnel"],
    queryFn: () => rpc<Funnel[]>("booking_funnel_report"),
    refetchInterval: 60_000,
  });
  return (
    <section className="surface-panel my-6 p-5" aria-label="Booking conversion">
      <h2 className="text-lg font-semibold">Booking conversion · last 30 days</h2>
      <p className="my-2 text-sm text-muted-foreground">
        Unique browser visits reaching each step, split by screen size. Counts are directional, not
        an ordered cohort; blocked tracking, returning visits and device changes can affect them.
        Final statuses reflect the current state of tracked requests.
      </p>
      {query.isLoading ? (
        <p role="status">Loading conversion data…</p>
      ) : query.error ? (
        <p role="status">Conversion reporting is temporarily unavailable.</p>
      ) : !query.data?.length ? (
        <p>No visits recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Device",
                  "Space viewed",
                  "Time selected",
                  "Checkout",
                  "Requested",
                  "Confirmed / attended",
                  "Cancelled",
                  "Expired",
                ].map((label) => (
                  <th className="p-2" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.map((row) => (
                <tr key={row.device}>
                  {[
                    row.device,
                    row.space_viewed,
                    row.time_selected,
                    row.checkout_started,
                    row.request_submitted,
                    row.confirmed,
                    row.cancelled,
                    row.expired,
                  ].map((value, index) => (
                    <td className="p-2" key={index}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
