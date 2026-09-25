/**
 * DEMO availability generator — presentation only (Milestone 1).
 *
 * This is NOT the booking engine. It produces plausible free/busy slots so the
 * picker can be designed and tested. Real availability must be calculated
 * server-side against resource allocations in Milestone 3.
 */
import {
  bookingRules,
  demoBookings,
  operatingHours,
  type Service,
} from "@/data/demo";
import { addMinutesToTime } from "@/lib/format";

export interface DemoSlot {
  start: string;
  end: string;
  available: boolean;
  reason?: string | undefined;
}

function dayWindow(dateISO: string): { open: string; close: string } | null {
  const [y, m, d] = dateISO.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (weekday === 0 && operatingHours.sundayClosed) return null;
  if (weekday === 6)
    return { open: operatingHours.saturdayOpen, close: operatingHours.saturdayClose };
  return { open: operatingHours.weekdayOpen, close: operatingHours.weekdayClose };
}

export function isClosed(dateISO: string): boolean {
  return dayWindow(dateISO) === null;
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number) as [number, number, number];
  return h * 60 + m;
}

/** Bookings that occupy any resource this service needs, on that date. */
function occupiedIntervals(service: Service, dateISO: string): Array<[number, number]> {
  const blocking = new Set(["held", "pending_confirmation", "confirmed", "checked_in"]);
  return demoBookings
    .filter((b) => b.date === dateISO && blocking.has(b.bookingState))
    .filter((b) => {
      const other = demoBookings.find((x) => x.reference === b.reference);
      if (!other) return false;
      // shared-resource collision across different services
      const otherService = servicesById[b.serviceId];
      if (!otherService) return false;
      return otherService.resourceIds.some((r) => service.resourceIds.includes(r));
    })
    .map((b) => [toMin(b.start), toMin(b.end)] as [number, number]);
}

let servicesById: Record<string, Service> = {};
export function registerServices(list: Service[]) {
  servicesById = Object.fromEntries(list.map((s) => [s.id, s]));
}

export function generateSlots(
  service: Service,
  dateISO: string,
  durationMinutes: number,
): DemoSlot[] {
  const window = dayWindow(dateISO);
  if (!window) return [];

  const buffer = bookingRules.bufferMinutes;
  const occupied = occupiedIntervals(service, dateISO);
  const closeMin = toMin(window.close);
  const slots: DemoSlot[] = [];

  for (let t = toMin(window.open); t + durationMinutes <= closeMin; t += service.stepMinutes) {
    const startStr = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    const occStart = t - buffer;
    const occEnd = t + durationMinutes + buffer;
    // half-open intervals [start, end)
    const clash = occupied.some(([s, e]) => occStart < e && s < occEnd);
    slots.push({
      start: startStr,
      end: addMinutesToTime(startStr, durationMinutes),
      available: !clash,
      reason: clash ? "Already reserved" : undefined,
    });
  }
  return slots;
}

export function durationOptions(service: Service): number[] {
  const out: number[] = [];
  for (
    let d = service.minDurationMinutes;
    d <= Math.min(service.maxDurationMinutes, 480);
    d += service.stepMinutes
  ) {
    out.push(d);
  }
  return out;
}
