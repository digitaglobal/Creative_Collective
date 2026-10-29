import { useQueries } from "@tanstack/react-query";
import { rpc } from "@/lib/supabase";
import type { Slot } from "@/lib/booking";
import { Button } from "@/components/ui/button";

function dayAvailability(slots: Slot[], closed: boolean) {
  if (closed) return "Closed";
  const count = slots.filter((s) => s.available).length;
  if (count) return `${count} available`;
  if (slots.length && slots.every((s) => s.reason?.includes("Already reserved")))
    return "Fully booked";
  if (slots.length && slots.every((s) => /closed/i.test(s.reason ?? ""))) return "Closed";
  return "No times";
}
export function AvailabilityWeek({
  days,
  date,
  onDate,
  serviceId,
  duration,
  extras,
  enabled,
  sundayClosed,
}: {
  days: string[];
  date: string;
  onDate: (date: string) => void;
  serviceId: string;
  duration: number;
  extras: string[];
  enabled: boolean;
  sundayClosed: boolean;
}) {
  const index = Math.max(0, days.indexOf(date));
  const offset = Math.floor(index / 7) * 7;
  const week = days.slice(offset, offset + 7);
  const queries = useQueries({
    queries: week.map((day) => ({
      queryKey: ["availability", serviceId, day, duration, extras],
      enabled,
      queryFn: () =>
        rpc<Slot[]>("available_slots", {
          p_service: serviceId,
          p_date: day,
          p_duration: duration,
          p_extra_ids: extras,
        }),
      staleTime: 15_000,
      refetchInterval: 30_000,
    })),
  });
  return (
    <section aria-label="Weekly availability" className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Choose a date</h2>
        <span className="text-xs text-muted-foreground">Jamaica time</span>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        Jump to a date
        <input
          aria-label="Booking date"
          type="date"
          min={days[0]}
          max={days.at(-1)}
          value={date}
          onChange={(e) => {
            if (days.includes(e.target.value)) onDate(e.target.value);
          }}
          className="min-h-11 min-w-0 w-full rounded-lg border bg-background p-2"
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={offset === 0}
          onClick={() => onDate(days[Math.max(0, offset - 7)]!)}
          aria-label="Previous week"
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          {week[0]?.slice(5)} to {week.at(-1)?.slice(5)}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={offset + 7 >= days.length}
          onClick={() => onDate(days[offset + 7]!)}
          aria-label="Next week"
        >
          Next
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
        {week.map((day, i) => {
          const q = queries[i]!;
          const closed = sundayClosed && new Date(day + "T12:00:00Z").getUTCDay() === 0;
          const label = !enabled
            ? "Setup pending"
            : q.isPending
              ? "Checking..."
              : q.isError
                ? "Check failed"
                : dayAvailability(q.data ?? [], closed);
          return (
            <button
              type="button"
              key={day}
              aria-pressed={date === day}
              onClick={() => onDate(day)}
              className={`min-h-20 min-w-0 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-primary ${date === day ? "border-primary bg-primary/10" : "hover:border-primary"}`}
            >
              <span className="block text-sm font-semibold">
                {new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", {
                  timeZone: "America/Jamaica",
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {enabled
          ? "Availability matches your duration and extras. Fully booked means every start is reserved; no times can also mean notice limits or a session that does not fit. Selecting a date keeps your other choices."
          : "Dates are for planning enquiries. Live availability will appear after venue setup is approved."}
      </p>
      {enabled && queries.some((q) => q.isError) && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void Promise.all(queries.filter((q) => q.isError).map((q) => q.refetch()))}
        >
          Retry availability
        </Button>
      )}
    </section>
  );
}
