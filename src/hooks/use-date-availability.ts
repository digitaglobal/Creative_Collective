import { useQuery } from "@tanstack/react-query";
import type { Service } from "@/data/catalog";
import { backendConfigured, rpc } from "@/lib/supabase";
import type { Slot } from "@/lib/booking";

/** A date match means at least one slot for the shortest booking, without extras. */
export function useDateAvailability(services: Service[], date: string | undefined, ready: boolean) {
  const eligible = services.filter(
    (s) =>
      s.status === "published" &&
      s.bookableHourly &&
      s.hourlyRateMinor !== null &&
      s.resourceIds.length > 0,
  );
  const ids = eligible
    .map((s) => `${s.id}:${s.minDurationMinutes}`)
    .sort()
    .join(",");
  return useQuery({
    queryKey: ["discovery-availability", date, ids],
    enabled: Boolean(date && ready && backendConfigured),
    queryFn: async () => {
      const results = await Promise.all(
        eligible.map(async (service) => {
          const slots = await rpc<Slot[]>("available_slots", {
            p_service: service.id,
            p_date: date,
            p_duration: service.minDurationMinutes,
            p_extra_ids: [],
          });
          return [service.id, slots.some((slot) => slot.available)] as const;
        }),
      );
      return Object.fromEntries(results);
    },
    staleTime: 30_000,
  });
}
