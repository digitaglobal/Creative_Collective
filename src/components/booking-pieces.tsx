import { Check, Info, Minus, PackageOpen } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DraftBadge } from "@/components/status-badges";
import { ImagePlaceholder } from "@/components/demo-banner";
import { CURRENCY, VENUE_TIMEZONE_LABEL, type ContentType, type Service } from "@/data/catalog";
import { formatDuration, formatMoney } from "@/lib/format";

export function ServiceCard({ service }: { service: Service }) {
  const bookable =
    service.status === "published" && service.bookableHourly && service.hourlyRateMinor !== null;
  return (
    <article className="surface-panel flex flex-col overflow-hidden">
      {service.imageUrl ? (
        <img src={service.imageUrl} alt={service.imageAlt} className="h-40 w-full object-cover" />
      ) : (
        <ImagePlaceholder alt={service.imageAlt} className="h-40 rounded-none" />
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{service.name}</h3>
          {service.status === "draft" ? <DraftBadge reason={service.draftReason} /> : null}
        </div>
        <p className="text-sm text-muted-foreground">{service.useCase}</p>
        <dl className="mt-auto grid grid-cols-2 gap-3 pt-2 text-sm">
          <div>
            <dt className="text-muted-foreground">From</dt>
            <dd className="font-medium">
              {!service.publishedPrices.length ? (
                <span className="text-muted-foreground">Rate not set</span>
              ) : (
                service.publishedPrices
                  .map((price) => `${price.label}: ${formatMoney(price.amountMinor)}`)
                  .join(" · ")
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Up to</dt>
            <dd className="font-medium">
              {service.bookableHourly
                ? `${service.maxAttendees} ${service.maxAttendees === 1 ? "person" : "people"}`
                : "Inquiry"}
            </dd>
          </div>
        </dl>
        <Button asChild variant={bookable ? "default" : "secondary"} className="mt-2 w-full">
          <Link to="/$brand/services/$slug" params={{ brand: service.brand, slug: service.slug }}>
            {bookable ? "View details" : "Pricing and inquiries"}
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function PublishedPriceList({ service }: { service: Service }) {
  if (!service.publishedPrices.length) return null;
  return (
    <section className="surface-panel p-5">
      <h2 className="font-semibold">Published prices</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {service.publishedPrices.map((price) => (
          <div key={price.label} className="flex justify-between gap-4 border-b border-border py-2">
            <dt className="text-muted-foreground">{price.label}</dt>
            <dd className="font-medium tabular-nums">{formatMoney(price.amountMinor)}</dd>
          </div>
        ))}
      </dl>
      {!service.bookableHourly ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Contact the venue to arrange this service.
        </p>
      ) : null}
    </section>
  );
}

const contentMeta: Record<ContentType, { title: string; icon: ReactNode }> = {
  included: { title: "Included", icon: <Check className="size-4" aria-hidden /> },
  "not-included": { title: "Not included", icon: <Minus className="size-4" aria-hidden /> },
  bring: { title: "What you need to bring", icon: <PackageOpen className="size-4" aria-hidden /> },
};

export function InclusionList({ type, items }: { type: ContentType; items: string[] }) {
  const meta = contentMeta[type];
  return (
    <section className="surface-panel p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {meta.icon}
        {meta.title}
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface QuoteLine {
  label: string;
  detail?: string;
  amountMinor: number | null;
}

export function PriceBreakdown({
  lines,
  totalMinor,
  note,
}: {
  lines: QuoteLine[];
  totalMinor: number;
  note?: string;
}) {
  return (
    <div className="space-y-3">
      <dl className="space-y-2 text-sm">
        {lines.map((line) => (
          <div key={line.label} className="flex items-start justify-between gap-4">
            <dt>
              {line.label}
              {line.detail ? (
                <span className="block text-xs text-muted-foreground">{line.detail}</span>
              ) : null}
            </dt>
            <dd className="shrink-0 tabular-nums">
              {line.amountMinor === null ? (
                <span className="text-muted-foreground">Not configured</span>
              ) : (
                formatMoney(line.amountMinor)
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <p className="font-semibold">Total ({CURRENCY})</p>
        <p className="text-lg font-semibold tabular-nums">{formatMoney(totalMinor)}</p>
      </div>
      <p className="flex gap-2 text-xs text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        {note ??
          "Estimate only. Tax is not configured, which is not the same as zero. Final totals will be calculated by the server."}
      </p>
    </div>
  );
}

const steps = ["Choose a time", "Sign in", "Review and reserve", "Confirmation"];

export function BookingStepper({ current }: { current: number }) {
  return (
    <nav aria-label="Booking progress">
      <ol className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
        {steps.map((step, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li key={step} className="flex items-center gap-2">
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={
                  state === "todo"
                    ? "text-muted-foreground"
                    : state === "current"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                }
              >
                {i + 1}. {step}
                {state === "done" ? <span className="sr-only"> (completed)</span> : null}
              </span>
              {i < steps.length - 1 ? (
                <span aria-hidden className="text-muted-foreground">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function BookingSummary({
  service,
  dateLabel,
  start,
  end,
  durationMinutes,
  attendees,
  children,
}: {
  service: Service;
  dateLabel: string;
  start: string;
  end: string;
  durationMinutes: number;
  attendees: number;
  children?: ReactNode;
}) {
  return (
    <div className="surface-panel space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold">{service.name}</h2>
        <p className="text-sm text-muted-foreground">
          {service.brand === "enigma" ? "Enigma" : "Studio D"}
        </p>
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Date</dt>
          <dd className="text-right">{dateLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Time</dt>
          <dd className="text-right">
            {start} – {end}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Duration</dt>
          <dd className="text-right">{formatDuration(durationMinutes)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Attendees</dt>
          <dd className="text-right">{attendees}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Timezone</dt>
          <dd className="text-right">{VENUE_TIMEZONE_LABEL}</dd>
        </div>
      </dl>
      {children}
    </div>
  );
}
