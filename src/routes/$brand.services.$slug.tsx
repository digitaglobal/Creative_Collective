import { AvailabilityWeek } from "@/components/availability-week";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { trackBookingStep } from "@/lib/booking-analytics";
import { SiteLayout } from "@/components/site-chrome";
import { VenueImage } from "@/components/venue-image";
import { servicePhoto } from "@/data/venue-media";
import { DraftBadge } from "@/components/status-badges";
import {
  BookingStepper,
  InclusionList,
  PriceBreakdown,
  PublishedPriceList,
} from "@/components/booking-pieces";
import { Button } from "@/components/ui/button";
import {
  bookingRules,
  getBrand,
  getServiceBySlug,
  resourceNames,
  VENUE_TIMEZONE_LABEL,
} from "@/data/catalog";
import type { Catalog } from "@/hooks/use-catalog";
import { DEMO_MODE } from "@/data/catalog";
import { useCatalog } from "@/hooks/use-catalog";
import { useQuery } from "@tanstack/react-query";
import { rpc, backendConfigured } from "@/lib/supabase";
import { venueDate, type Slot } from "@/lib/booking";
import { EnquiryForm } from "@/components/enquiry-form";
import { formatDateShort, formatDuration, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/$brand/services/$slug")({
  validateSearch: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .catch(undefined),
    duration: z.coerce.number().int().positive().optional().catch(undefined),
    attendees: z.coerce.number().int().positive().optional().catch(undefined),
    start: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .optional()
      .catch(undefined),
    extras: z.string().optional(),
  }),
  loader: async ({ params }) => {
    const catalog = backendConfigured ? await rpc<Catalog>("public_catalog") : null;
    const service = catalog
      ? catalog.services.find((s) => s.brand === params.brand && s.slug === params.slug)
      : DEMO_MODE
        ? getServiceBySlug(params.brand, params.slug)
        : undefined;
    const brand = catalog
      ? catalog.brands.find((b) => b.slug === params.brand)
      : getBrand(params.brand);
    if (!service || !brand) throw notFound();
    return { service, brand };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.service.name} at ${loaderData.brand.name}`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.service.description },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.service.description },
      ],
    };
  },
  component: ServicePage,
});

function nextDays(n: number): string[] {
  const out: string[] = [];
  const [y, m, d] = venueDate().split("-").map(Number) as [number, number, number];
  for (let i = 0; i < n; i++) {
    out.push(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
  }
  return out;
}

function ServicePage() {
  const selection = Route.useSearch();
  const initial = Route.useLoaderData();
  const catalog = useCatalog();
  const service =
    catalog.data?.services.find((s) => s.id === initial.service.id) ?? initial.service;
  const brand = catalog.data?.brands.find((b) => b.slug === initial.brand.slug) ?? initial.brand;
  const navigate = useNavigate();
  const bookable =
    backendConfigured &&
    Boolean(catalog.data?.ready) &&
    service.resourceIds.length > 0 &&
    service.status === "published" &&
    service.bookableHourly &&
    service.hourlyRateMinor !== null;
  const days = useMemo(
    () => nextDays((catalog.data?.rules.horizonDays ?? 90) + 1),
    [catalog.data?.rules.horizonDays],
  );
  const durations = Array.from(
    {
      length:
        Math.floor(
          (service.maxDurationMinutes - service.minDurationMinutes) / service.stepMinutes,
        ) + 1,
    },
    (_, i) => service.minDurationMinutes + i * service.stepMinutes,
  );
  const [date, setDate] = useState(
    selection.date && days.includes(selection.date) ? selection.date : venueDate(),
  );
  const [duration, setDuration] = useState(
    selection.duration && durations.includes(selection.duration)
      ? selection.duration
      : (durations[0] ?? service.minDurationMinutes),
  );
  const [attendees, setAttendees] = useState(
    Math.min(service.maxAttendees, selection.attendees ?? 1),
  );
  const [start, setStart] = useState<string | null>(selection.start ?? null);
  const [extras, setExtras] = useState<string[]>(
    (selection.extras ?? "")
      .split(",")
      .filter((id) => service.addons.some((a) => a.id === id && a.status === "published")),
  );
  useEffect(() => {
    trackBookingStep("space_viewed", service.id);
  }, [service.id]);
  const availability = useQuery({
    queryKey: ["availability", service.id, date, duration, extras],
    enabled: bookable,
    queryFn: () =>
      rpc<Slot[]>("available_slots", {
        p_service: service.id,
        p_date: date,
        p_duration: duration,
        p_extra_ids: extras,
      }),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  const slots = availability.data ?? [];
  const alternatives = useQuery({
    queryKey: ["alternative-times", service.id, date, duration, extras],
    enabled: bookable && availability.isSuccess && !slots.some((slot) => slot.available),
    queryFn: async () => {
      const candidates = days.filter((day) => day > date).slice(0, 7);
      const results = await Promise.all(
        candidates.map(async (day) => {
          const times = await rpc<Slot[]>("available_slots", {
            p_service: service.id,
            p_date: day,
            p_duration: duration,
            p_extra_ids: extras,
          });
          return times
            .filter((slot) => slot.available)
            .slice(0, 2)
            .map((slot) => ({ date: day, start: slot.start }));
        }),
      );
      return results.flat().slice(0, 4);
    },
    staleTime: 0,
  });
  const rate = service.hourlyRateMinor ?? 0;
  const base =
    Math.round((rate * duration) / 60) +
    service.addons
      .filter((a) => extras.includes(a.id))
      .reduce(
        (sum, a) => sum + Math.round(a.amountMinor * (a.basis === "per-hour" ? duration / 60 : 1)),
        0,
      );

  const tax =
    catalog.data?.taxBasisPoints == null
      ? null
      : Math.round((base * catalog.data.taxBasisPoints) / 10000);
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 pb-32 pt-10 lg:pb-10">
        <p className="text-sm text-muted-foreground">{brand.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">{service.name}</h1>
          {service.status === "draft" ? <DraftBadge reason={service.draftReason} /> : null}
        </div>
        <p className="mt-2 max-w-2xl text-muted-foreground">{service.description}</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <VenueImage
              photo={servicePhoto(service)}
              alt={service.imageAlt}
              className="h-72 rounded-xl sm:h-96"
              eager
            />
            {servicePhoto(service)?.caption && (
              <p className="text-xs text-muted-foreground">{servicePhoto(service)?.caption}</p>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              <InclusionList type="included" items={service.content.included} />
              <InclusionList type="not-included" items={service.content["not-included"]} />
              <InclusionList type="bring" items={service.content.bring} />
            </div>
            <PublishedPriceList service={service} />
            {brand.slug === "enigma" ? (
              <p className="text-sm text-muted-foreground">
                Enigma prices are quoted in JMD, tax exclusive, and subject to change. Daily,
                weekly, and monthly prices are shown for reference; online booking is hourly only.
              </p>
            ) : null}
            <dl className="surface-panel grid gap-4 p-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Space used</dt>
                <dd>{resourceNames(service) || "Allocated by staff after inventory review"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Capacity</dt>
                <dd>Up to {service.maxAttendees}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Length</dt>
                <dd>
                  {formatDuration(service.minDurationMinutes)} to{" "}
                  {formatDuration(service.maxDurationMinutes)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Facilities</dt>
                <dd>{service.facilitiesStatus}</dd>
              </div>
            </dl>
            {service.addons.length ? (
              <section className="surface-panel p-5">
                <h2 className="font-semibold">Extras</h2>
                <ul className="mt-3 space-y-3 text-sm">
                  {service.addons.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {a.name} — <span className="text-muted-foreground">{a.description}</span>
                      </span>
                      {a.status === "draft" ? (
                        <DraftBadge reason={a.draftReason} />
                      ) : (
                        formatMoney(a.amountMinor)
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="surface-panel min-w-0 h-fit space-y-5 rounded-2xl p-5">
            <BookingStepper current={0} />
            {catalog.isSuccess && (
              <AvailabilityWeek
                days={days}
                date={date}
                onDate={(day) => {
                  setDate(day);
                  setStart(null);
                }}
                serviceId={service.id}
                duration={duration}
                extras={extras}
                enabled={bookable}
                sundayClosed={catalog.data?.hours?.sundayClosed ?? false}
              />
            )}
            {!bookable ? (
              <p className="text-sm text-muted-foreground">
                {service.draftReason ||
                  "Online reservations for this service await approved venue configuration. Send an enquiry below."}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium">
                    Duration
                    <select
                      aria-label="Duration"
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                      value={duration}
                      onChange={(e) => {
                        setDuration(Number(e.target.value));
                        setStart(null);
                      }}
                    >
                      {durations.map((d) => (
                        <option key={d} value={d}>
                          {formatDuration(d)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Attendees
                    <input
                      aria-label="Booking attendees"
                      type="number"
                      min={1}
                      max={service.maxAttendees}
                      value={attendees}
                      onChange={(e) =>
                        setAttendees(
                          Math.min(service.maxAttendees, Math.max(1, Number(e.target.value))),
                        )
                      }
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                    />
                  </label>
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">
                    Start time{" "}
                    <span className="font-normal text-muted-foreground">
                      ({VENUE_TIMEZONE_LABEL})
                    </span>
                  </legend>
                  <p className="mt-2 text-sm font-medium" aria-live="polite">
                    {formatDateShort(date)}
                    {start ? ` · Selected ${start}` : " · Choose a start time"}
                  </p>
                  {availability.isLoading ? (
                    <p role="status">Checking availability…</p>
                  ) : availability.error ? (
                    <p role="alert">
                      Could not check times.{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => void availability.refetch()}
                      >
                        Try again
                      </button>
                    </p>
                  ) : slots.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No times on this day.</p>
                  ) : (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {slots.map((s) => (
                        <button
                          key={s.start}
                          type="button"
                          disabled={!s.available}
                          title={s.reason}
                          aria-pressed={start === s.start}
                          onClick={() => {
                            setStart(s.start);
                            trackBookingStep("time_selected", service.id);
                          }}
                          className={`min-h-11 rounded-lg border px-2 py-2 text-sm tabular-nums ${start === s.start ? "border-primary bg-primary text-primary-foreground" : "border-border"} disabled:line-through disabled:opacity-40`}
                        >
                          {s.start}
                        </button>
                      ))}
                    </div>
                  )}
                </fieldset>
                {availability.isSuccess && !slots.some((slot) => slot.available) && (
                  <section aria-label="Alternative times" className="space-y-2 text-sm">
                    <p>No available times for this duration and extras on this date.</p>
                    {alternatives.isLoading ? (
                      <p role="status">Finding nearby dates…</p>
                    ) : alternatives.error ? (
                      <p role="alert">
                        Could not check nearby dates. Try another date or send an enquiry below.
                      </p>
                    ) : alternatives.data?.length ? (
                      <>
                        <p className="font-medium">Try one of these available times:</p>
                        {alternatives.data.map((option) => (
                          <button
                            type="button"
                            key={option.date + option.start}
                            className="mr-2 rounded border px-3 py-2"
                            onClick={() => {
                              setDate(option.date);
                              setStart(option.start);
                              trackBookingStep("time_selected", service.id);
                            }}
                          >
                            {formatDateShort(option.date)} · {option.start}
                          </button>
                        ))}
                      </>
                    ) : (
                      <p>
                        Nothing available in the next seven days within the booking window. Try
                        another date, adjust the duration, or send an enquiry below.
                      </p>
                    )}
                  </section>
                )}
                <PriceBreakdown
                  lines={[
                    {
                      label: `${formatDuration(duration)} × ${formatMoney(rate)}/hr`,
                      amountMinor: Math.round((rate * duration) / 60),
                    },
                    ...service.addons
                      .filter((a) => extras.includes(a.id))
                      .map((a) => ({
                        label: a.name,
                        amountMinor: Math.round(
                          a.amountMinor * (a.basis === "per-hour" ? duration / 60 : 1),
                        ),
                      })),
                    { label: "Tax", amountMinor: tax },
                  ]}
                  totalMinor={tax === null ? null : base + tax}
                  note={
                    tax === null
                      ? "Tax awaits approved configuration."
                      : "Current estimate. Availability and rates are rechecked when you submit."
                  }
                />
                <div className="space-y-2">
                  {service.addons
                    .filter((a) => a.status === "published")
                    .map((a) => (
                      <label key={a.id} className="flex gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={extras.includes(a.id)}
                          onChange={(e) => {
                            setExtras(
                              e.target.checked
                                ? [...extras, a.id]
                                : extras.filter((id) => id !== a.id),
                            );
                            setStart(null);
                          }}
                        />
                        {a.name} ? {formatMoney(a.amountMinor)} {a.basis}
                      </label>
                    ))}
                </div>
                <p className="text-sm">
                  Request this time for staff approval. Pay in person after approval; no online
                  payment is collected. Selecting a time does not hold it.
                </p>
                <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-4 shadow-lg lg:static lg:p-0 lg:pt-3 lg:shadow-none">
                  <p className="mb-2 text-sm font-medium">
                    {tax === null
                      ? "Total awaits tax confirmation"
                      : `Total: ${formatMoney(base + tax)}`}{" "}
                    · {formatDuration(duration)}
                  </p>
                  <Button
                    className="w-full"
                    disabled={!start || !slots.some((s) => s.start === start && s.available)}
                    onClick={() =>
                      start &&
                      navigate({
                        to: "/checkout",
                        search: {
                          service: service.id,
                          date,
                          start,
                          duration,
                          attendees,
                          extras: extras.join(","),
                        },
                      })
                    }
                  >
                    Continue
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Book at least{" "}
                  {catalog.data?.rules.advanceNoticeHours ?? bookingRules.advanceNoticeHours} hours
                  ahead, up to {catalog.data?.rules.horizonDays ?? bookingRules.horizonDays} days
                  out.
                </p>
              </>
            )}
            <EnquiryForm
              key={service.id}
              serviceId={service.id}
              date={date}
              attendees={attendees}
              start={start}
              duration={duration}
            />
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
