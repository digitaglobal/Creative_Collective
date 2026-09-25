import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteLayout } from "@/components/site-chrome";
import { ImagePlaceholder } from "@/components/demo-banner";
import { DraftBadge } from "@/components/status-badges";
import { BookingStepper, InclusionList, PriceBreakdown, PublishedPriceList } from "@/components/booking-pieces";
import { Button } from "@/components/ui/button";
import {
  bookingRules,
  getBrand,
  getServiceBySlug,
  resourceNames,
  services,
  todayISO,
  VENUE_TIMEZONE_LABEL,
} from "@/data/demo";
import { durationOptions, generateSlots, isClosed, registerServices } from "@/lib/demo-availability";
import { formatDateShort, formatDuration, formatMoney } from "@/lib/format";

registerServices(services);

export const Route = createFileRoute("/$brand/services/$slug")({
  loader: ({ params }) => {
    const service = getServiceBySlug(params.brand, params.slug);
    const brand = getBrand(params.brand);
    if (!service || !brand) throw notFound();
    return { service, brand };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
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
  const [y, m, d] = todayISO.split("-").map(Number) as [number, number, number];
  for (let i = 0; i < n; i++) {
    out.push(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
  }
  return out;
}

function ServicePage() {
  const { service, brand } = Route.useLoaderData();
  const navigate = useNavigate();
  const bookable = service.status === "published" && service.bookableHourly && service.hourlyRateMinor !== null;
  const days = useMemo(() => nextDays(14), []);
  const durations = durationOptions(service);
  const [date, setDate] = useState(days.find((d) => !isClosed(d)) ?? todayISO);
  const [duration, setDuration] = useState(durations[0] ?? service.minDurationMinutes);
  const [attendees, setAttendees] = useState(1);
  const [start, setStart] = useState<string | null>(null);
  const slots = generateSlots(service, date, duration);
  const rate = service.hourlyRateMinor ?? 0;
  const base = Math.round((rate * duration) / 60);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <p className="text-sm text-muted-foreground">{brand.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">{service.name}</h1>
          {service.status === "draft" ? <DraftBadge reason={service.draftReason} /> : null}
        </div>
        <p className="mt-2 max-w-2xl text-muted-foreground">{service.description}</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <ImagePlaceholder alt={service.imageAlt} className="h-64" />
            <div className="grid gap-4 md:grid-cols-3">
              <InclusionList type="included" items={service.content.included} />
              <InclusionList type="not-included" items={service.content["not-included"]} />
              <InclusionList type="bring" items={service.content.bring} />
            </div>
            <PublishedPriceList service={service} />
            {brand.slug === "enigma" ? <p className="text-sm text-muted-foreground">Enigma prices are quoted in JMD, tax exclusive, and subject to change. Daily, weekly, and monthly prices are shown for reference; online booking is hourly only.</p> : null}
            <dl className="surface-panel grid gap-4 p-5 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Space used</dt><dd>{resourceNames(service)}</dd></div>
              <div><dt className="text-muted-foreground">Capacity</dt><dd>Up to {service.maxAttendees}</dd></div>
              <div><dt className="text-muted-foreground">Length</dt><dd>{formatDuration(service.minDurationMinutes)} to {formatDuration(service.maxDurationMinutes)}</dd></div>
              <div><dt className="text-muted-foreground">Facilities</dt><dd>{service.facilitiesStatus}</dd></div>
            </dl>
            {service.addons.length ? (
              <section className="surface-panel p-5">
                <h2 className="font-semibold">Extras</h2>
                <ul className="mt-3 space-y-3 text-sm">
                  {service.addons.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{a.name} — <span className="text-muted-foreground">{a.description}</span></span>
                      {a.status === "draft" ? <DraftBadge reason={a.draftReason} /> : formatMoney(a.amountMinor)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="surface-panel h-fit space-y-5 p-5 lg:sticky lg:top-28">
            <BookingStepper current={0} />
            {!bookable ? (
              <p className="text-sm text-muted-foreground">
                This service can't be booked yet: {service.draftReason}.
              </p>
            ) : (
              <>
                <fieldset>
                  <legend className="text-sm font-medium">Date</legend>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {days.map((d) => {
                      const closed = isClosed(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={closed}
                          aria-pressed={d === date}
                          onClick={() => { setDate(d); setStart(null); }}
                          className={`shrink-0 rounded-md border px-3 py-2 text-xs ${d === date ? "border-primary bg-primary text-primary-foreground" : "border-border"} disabled:opacity-40`}
                        >
                          {formatDateShort(d).replace(/ \d{4}$/, "")}
                          {closed ? <span className="block">Closed</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium">
                    Duration
                    <select className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setStart(null); }}>
                      {durations.map((d) => <option key={d} value={d}>{formatDuration(d)}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Attendees
                    <input type="number" min={1} max={service.maxAttendees} value={attendees} onChange={(e) => setAttendees(Math.min(service.maxAttendees, Math.max(1, Number(e.target.value))))} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm" />
                  </label>
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">Start time <span className="font-normal text-muted-foreground">({VENUE_TIMEZONE_LABEL})</span></legend>
                  {slots.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No times on this day.</p>
                  ) : (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {slots.map((s) => (
                        <button key={s.start} type="button" disabled={!s.available} title={s.reason} aria-pressed={start === s.start} onClick={() => setStart(s.start)}
                          className={`rounded-md border px-2 py-1.5 text-xs tabular-nums ${start === s.start ? "border-primary bg-primary text-primary-foreground" : "border-border"} disabled:line-through disabled:opacity-40`}>
                          {s.start}
                        </button>
                      ))}
                    </div>
                  )}
                </fieldset>
                <PriceBreakdown lines={[{ label: `${formatDuration(duration)} × ${formatMoney(rate)}/hr`, amountMinor: base }, { label: "Tax", amountMinor: null }]} totalMinor={base} />
                <Button className="w-full" disabled={!start}
                  onClick={() => start && navigate({ to: "/checkout", search: { service: service.id, date, start, duration, attendees } })}>
                  Continue
                </Button>
                <p className="text-xs text-muted-foreground">Book at least {bookingRules.advanceNoticeHours} hours ahead, up to {bookingRules.horizonDays} days out.</p>
              </>
            )}
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
