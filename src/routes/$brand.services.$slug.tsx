import { AvailabilityWeek } from "@/components/availability-week";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { trackBookingStep } from "@/lib/booking-analytics";
import { SiteLayout } from "@/components/site-chrome";
import { VenueImage } from "@/components/venue-image";
import { brandPhotos, servicePhoto } from "@/data/venue-media";
import { DraftBadge } from "@/components/status-badges";
import { InclusionList, PriceBreakdown, PublishedPriceList } from "@/components/booking-pieces";
import { Button } from "@/components/ui/button";
import { bookingRules, getBrand, getServiceBySlug, resourceNames } from "@/data/catalog";
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
  pendingMs: 200,
  pendingMinMs: 0,
  pendingComponent: SpacePagePending,
  component: ServicePage,
});

function SpacePagePending() {
  return (
    <SiteLayout home>
      <div className="space-page" role="status" aria-label="Loading space details">
        <div className="psd-wrap space-page-inner space-page-pending" aria-hidden="true">
          <div className="space-skeleton space-pending-kicker" />
          <div className="space-skeleton space-pending-title" />
          <div className="space-gallery">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="space-gallery-item space-skeleton" key={index} />
            ))}
          </div>
          <div className="space-details">
            <div className="space-pending-copy">
              <div className="space-skeleton space-pending-heading" />
              <div className="space-skeleton space-pending-line" />
              <div className="space-skeleton space-pending-line short" />
              <div className="space-skeleton space-pending-list" />
            </div>
            <div className="space-booking space-pending-booking">
              <div className="space-skeleton space-pending-heading" />
              <div className="space-skeleton space-pending-line short" />
              <div className="space-skeleton space-pending-control" />
              <div className="space-skeleton space-pending-control" />
              <div className="space-time-controls">
                <div className="space-skeleton space-pending-control" />
                <div className="space-skeleton space-pending-control" />
              </div>
              <div className="space-skeleton space-pending-button" />
            </div>
          </div>
        </div>
        <div className="space-enquiry" aria-hidden="true">
          <div className="psd-wrap space-pending-form">
            <div className="space-skeleton space-pending-heading" />
            <div className="space-skeleton space-pending-line" />
            <div className="space-pending-form-row">
              <div className="space-skeleton space-pending-control" />
              <div className="space-skeleton space-pending-control" />
              <div className="space-skeleton space-pending-control" />
            </div>
            <div className="space-time-controls">
              <div className="space-skeleton space-pending-control" />
              <div className="space-skeleton space-pending-control" />
            </div>
            <div className="space-pending-form-row">
              <div className="space-skeleton space-pending-control" />
              <div className="space-skeleton space-pending-control" />
            </div>
            <div className="space-skeleton space-pending-message" />
            <div className="space-skeleton space-pending-submit" />
          </div>
        </div>
        <span className="sr-only">Loading space details</span>
      </div>
    </SiteLayout>
  );
}

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
    <SiteLayout home>
      <div className="space-page">
        <div className="psd-wrap space-page-inner">
          <p className="psd-kicker">
            <span />
            {brand.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1>
              {service.id === "svc-studio-rental" && service.name.toLowerCase() === "studio rental"
                ? "Studio Rental"
                : service.name}
            </h1>
            {service.status === "draft" ? <DraftBadge reason={service.draftReason} /> : null}
          </div>
          <div className="space-gallery">
            {(service.id === "svc-studio-rental"
              ? [
                  service.imageUrl ? servicePhoto(service) : brandPhotos["studio-d"].cover,
                  { src: "/images/venues/studio-psd-podcast.webp", alt: "Studio D podcast area" },
                  {
                    src: "/images/venues/studio-psd-studio.webp",
                    alt: "Studio D open studio floor",
                  },
                  { src: "/images/venues/studio-psd-entrance.webp", alt: "Studio D entrance" },
                  { src: "/images/venues/studio-psd-lounge.webp", alt: "Studio D lounge" },
                ]
              : [
                  servicePhoto(service),
                  ...brandPhotos[brand.slug].gallery
                    .filter((photo) => photo.src !== servicePhoto(service)?.src)
                    .slice(0, 4),
                ]
            )
              .filter((photo) => photo != null)
              .map((photo, index) => (
                <div className="space-gallery-item" key={photo.src}>
                  <VenueImage
                    photo={photo}
                    alt={photo.alt}
                    className="space-gallery-image"
                    eager={index === 0}
                    showLoading
                  />
                  <span>
                    {service.id === "svc-studio-rental"
                      ? ["Open studio", "Podcast area", "Studio", "Entrance", "Lounge"][index]
                      : index === 0
                        ? service.name
                        : brand.name}
                  </span>
                </div>
              ))}
          </div>
          {servicePhoto(service)?.caption && (
            <p className="space-photo-caption">{servicePhoto(service)?.caption}</p>
          )}
          <div className="space-details">
            <div className="space-details-copy space-y-6">
              <div>
                <h2>
                  {service.id === "svc-studio-rental"
                    ? "A studio you can set up your way"
                    : service.useCase}
                </h2>
                <p>{service.description}</p>
              </div>
              {service.brand === "studio-d" && (
                <nav className="space-options" aria-label="Studio D spaces">
                  {(
                    [
                      ["studio-rental", "Open studio rental", "The studio as an open space"],
                      [
                        "podcast-setup",
                        "Podcast configuration",
                        "The studio set up for podcasting",
                      ],
                      ["studio-lounge", "Studio Lounge", "Space only"],
                      ["recording-booth", "Recording Booth", "Space only"],
                    ] as const
                  ).map(([slug, name, description]) => (
                    <Link
                      key={slug}
                      to="/$brand/services/$slug"
                      params={{ brand: "studio-d", slug }}
                      aria-current={service.slug === slug ? "page" : undefined}
                    >
                      <strong>{name}</strong>
                      <span>{description}</span>
                    </Link>
                  ))}
                </nav>
              )}
              <div className="space-inclusions">
                <InclusionList type="included" items={service.content.included} />
                <InclusionList type="bring" items={service.content.bring} />
              </div>
              <details className="space-more-details">
                <summary>More space details and prices</summary>
                <div className="space-more-details-content">
                  <InclusionList type="not-included" items={service.content["not-included"]} />
                  <PublishedPriceList service={service} />
                  {brand.slug === "enigma" ? (
                    <p className="text-sm text-muted-foreground">
                      Enigma prices are quoted in JMD, tax exclusive, and subject to change. Daily,
                      weekly, and monthly prices are shown for reference; online booking is hourly
                      only.
                    </p>
                  ) : null}
                  <dl className="surface-panel grid gap-4 p-5 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Space used</dt>
                      <dd>
                        {resourceNames(service) || "Allocated by staff after inventory review"}
                      </dd>
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
                          <li
                            key={a.id}
                            className="flex flex-wrap items-center justify-between gap-2"
                          >
                            <span>
                              {a.name} —{" "}
                              <span className="text-muted-foreground">{a.description}</span>
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
              </details>
            </div>

            <aside className="space-booking min-w-0 h-fit space-y-5">
              <div>
                <h2>Request a time</h2>
                <p>Times in Jamaica time (America/Jamaica)</p>
              </div>
              {service.brand === "studio-d" &&
                (service.slug === "studio-rental" || service.slug === "podcast-setup") && (
                  <div className="space-setup">
                    <span>Setup</span>
                    <nav aria-label="Studio setup">
                      <Link
                        to="/$brand/services/$slug"
                        params={{ brand: "studio-d", slug: "studio-rental" }}
                        aria-current={service.slug === "studio-rental" ? "page" : undefined}
                      >
                        Open Studio
                      </Link>
                      <Link
                        to="/$brand/services/$slug"
                        params={{ brand: "studio-d", slug: "podcast-setup" }}
                        aria-current={service.slug === "podcast-setup" ? "page" : undefined}
                      >
                        Podcast
                      </Link>
                    </nav>
                  </div>
                )}
              <label className="space-booking-label">
                Date
                <input
                  aria-label="Booking date"
                  type="date"
                  disabled={!catalog.isSuccess}
                  min={days[0]}
                  max={days.at(-1)}
                  value={date}
                  onChange={(event) => {
                    if (days.includes(event.target.value)) {
                      setDate(event.target.value);
                      setStart(null);
                    }
                  }}
                />
              </label>
              {catalog.isSuccess && bookable && (
                <details className="space-availability">
                  <summary>View weekly availability</summary>
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
                    hideDate
                  />
                </details>
              )}
              {!bookable ? (
                <div className="space-unavailable">
                  <div className="space-time-controls">
                    <label className="space-booking-label">
                      Start
                      <select disabled aria-label="Start time unavailable">
                        <option>Unavailable</option>
                      </select>
                    </label>
                    <label className="space-booking-label">
                      End
                      <select disabled aria-label="End time unavailable">
                        <option>Unavailable</option>
                      </select>
                    </label>
                  </div>
                  <p>
                    {service.draftReason ||
                      "Online reservations for this service await approved venue configuration."}
                  </p>
                  <a className="space-enquiry-link" href="#enquiry">
                    Ask about this space
                  </a>
                </div>
              ) : (
                <>
                  <div className="space-time-controls">
                    <label className="space-booking-label">
                      Start
                      <span
                        className="space-availability-control"
                        aria-busy={availability.isLoading}
                      >
                        <select
                          aria-label="Start time"
                          disabled={availability.isLoading}
                          value={start ?? ""}
                          onChange={(event) => {
                            setStart(event.target.value || null);
                            if (event.target.value) trackBookingStep("time_selected", service.id);
                          }}
                        >
                          <option value="">Select a time</option>
                          {slots.map((slot) => (
                            <option key={slot.start} value={slot.start} disabled={!slot.available}>
                              {slot.start}
                              {!slot.available && slot.reason ? ` — ${slot.reason}` : ""}
                            </option>
                          ))}
                        </select>
                        {availability.isLoading && (
                          <span
                            className="space-skeleton space-availability-skeleton"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </label>
                    <label className="space-booking-label">
                      End
                      <select
                        aria-label="Duration"
                        value={duration}
                        onChange={(event) => {
                          setDuration(Number(event.target.value));
                        }}
                      >
                        {durations.map((minutes) => {
                          const [hours, startMinutes] = (start ?? "00:00").split(":").map(Number);
                          const end = (hours ?? 0) * 60 + (startMinutes ?? 0) + minutes;
                          const time = `${String(Math.floor((end % 1440) / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
                          return (
                            <option key={minutes} value={minutes}>
                              {start
                                ? `${time}${end >= 1440 ? " (+1 day)" : ""}`
                                : formatDuration(minutes)}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </div>
                  {availability.isLoading && <p role="status">Checking availability…</p>}
                  {availability.error && (
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
                  )}
                  {availability.isSuccess && slots.length === 0 && (
                    <p className="text-sm text-muted-foreground">No times on this day.</p>
                  )}
                  <label className="space-booking-label">
                    Attendees
                    <input
                      aria-label="Booking attendees"
                      type="number"
                      min={1}
                      max={service.maxAttendees}
                      value={attendees}
                      onChange={(event) =>
                        setAttendees(
                          Math.min(service.maxAttendees, Math.max(1, Number(event.target.value))),
                        )
                      }
                    />
                  </label>
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
                  <div className="space-booking-action">
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
                    {catalog.data?.rules.advanceNoticeHours ?? bookingRules.advanceNoticeHours}{" "}
                    hours ahead, up to {catalog.data?.rules.horizonDays ?? bookingRules.horizonDays}{" "}
                    days out.
                  </p>
                </>
              )}
            </aside>
          </div>
        </div>
        <section className="space-enquiry">
          <div className="psd-wrap">
            <EnquiryForm
              key={service.id}
              serviceId={service.id}
              date={date}
              attendees={attendees}
              start={start}
              duration={duration}
            />
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
