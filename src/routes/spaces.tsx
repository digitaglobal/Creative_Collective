import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useCatalog } from "@/hooks/use-catalog";
import { SiteLayout } from "@/components/site-chrome";
import { VenueImage } from "@/components/venue-image";
import { Button } from "@/components/ui/button";
import { servicePhoto } from "@/data/venue-media";
import { comparisonSpaces, matchingSpaces, purposes, spacePurpose } from "@/lib/space-discovery";
import { formatMoney } from "@/lib/format";
import type { Service } from "@/data/catalog";

export const Route = createFileRoute("/spaces")({
  validateSearch: z.object({
    purpose: z
      .enum(["workspace", "meeting", "studio", "recording", "lounge"])
      .optional()
      .catch(undefined),
    venue: z.enum(["enigma", "studio-d"]).optional().catch(undefined),
    people: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
    compare: z.string().max(500).optional().catch(undefined),
  }),
  head: () => ({
    meta: [
      { title: "Find and compare spaces | Creative Collective" },
      {
        name: "description",
        content:
          "Compare Enigma and Studio D spaces by purpose, group size, published prices and equipment.",
      },
    ],
  }),
  component: Spaces,
});

function DetailsLink({ service }: { service: Service }) {
  return (
    <Button asChild className="w-full">
      <Link to="/$brand/services/$slug" params={{ brand: service.brand, slug: service.slug }}>
        View details / enquire<span className="sr-only"> about {service.name}</span>
      </Link>
    </Button>
  );
}
function Prices({ service }: { service: Service }) {
  return service.publishedPrices.length ? (
    <dl className="space-y-1">
      {service.publishedPrices.map((price) => (
        <div key={price.label} className="flex flex-wrap justify-between gap-x-3">
          <dt>{price.label}</dt>
          <dd className="font-medium">{formatMoney(price.amountMinor)}</dd>
        </div>
      ))}
    </dl>
  ) : (
    <p>Price pending — ask the venue</p>
  );
}
function Spaces() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const catalog = useCatalog();
  const services = catalog.data?.services ?? [];
  const matches = matchingSpaces(services, filters);
  const selected = comparisonSpaces(services, filters.compare);
  const update = (next: Partial<typeof filters>) =>
    void navigate({ search: { ...filters, ...next }, replace: true });
  const toggle = (service: Service) => {
    const ids = selected.map((item) => item.id);
    update({
      compare:
        (ids.includes(service.id)
          ? ids.filter((id) => id !== service.id)
          : [...ids, service.id].slice(0, 3)
        ).join(",") || undefined,
    });
  };
  const field = "mt-2 w-full rounded border bg-background p-3";
  return (
    <SiteLayout>
      <div className="mx-auto w-full min-w-0 max-w-7xl px-4 pb-28 pt-10">
        <h1 className="text-3xl font-bold sm:text-4xl">Find your space</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Explore Enigma and Studio D together. Choose what you need, then compare up to three
          spaces.
        </p>
        <p className="mt-3 rounded border bg-muted p-3 text-sm">
          Published prices are in JMD. Tax and unapproved details remain pending. Group-size filters
          use listed capacities; confirm capacity, equipment and suitability with the venue before
          making plans.
        </p>
        <section
          aria-label="Filter spaces"
          className="surface-panel my-6 grid gap-4 p-4 sm:grid-cols-3"
        >
          <label>
            What do you need?
            <select
              className={field}
              aria-label="Purpose"
              disabled={catalog.isLoading}
              value={filters.purpose ?? ""}
              onChange={(event) =>
                update({ purpose: (event.target.value as typeof filters.purpose) || undefined })
              }
            >
              <option value="">All spaces</option>
              {Object.entries(purposes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Venue
            <select
              aria-label="Venue"
              disabled={catalog.isLoading}
              className={field}
              value={filters.venue ?? ""}
              onChange={(event) =>
                update({ venue: (event.target.value as typeof filters.venue) || undefined })
              }
            >
              <option value="">Both venues</option>
              <option value="enigma">Enigma</option>
              <option value="studio-d">Studio D</option>
            </select>
          </label>
          <label>
            Group size
            <select
              aria-label="Group size"
              disabled={catalog.isLoading}
              className={field}
              value={filters.people ?? ""}
              onChange={(event) =>
                update({ people: event.target.value ? Number(event.target.value) : undefined })
              }
            >
              <option value="">Any size</option>
              {[
                ...new Set([
                  1,
                  2,
                  3,
                  4,
                  5,
                  6,
                  8,
                  10,
                  12,
                  20,
                  ...(filters.people ? [filters.people] : []),
                ]),
              ]
                .sort((a, b) => a - b)
                .map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "person" : "people"}
                  </option>
                ))}
            </select>
          </label>
          <Button
            variant="outline"
            onClick={() => update({ purpose: undefined, venue: undefined, people: undefined })}
          >
            Clear filters
          </Button>
        </section>
        {catalog.isLoading ? (
          <p role="status">Loading spaces…</p>
        ) : catalog.error ? (
          <div role="alert">
            <p>We couldn’t load the spaces. Please try again.</p>
            <Button onClick={() => void catalog.refetch()}>Retry</Button>
          </div>
        ) : (
          <>
            <p role="status" className="mb-4">
              {matches.length} {matches.length === 1 ? "space matches" : "spaces match"} your
              filters
            </p>
            {!matches.length && (
              <div className="surface-panel p-6">
                <h2 className="font-semibold">No matching spaces</h2>
                <p className="mt-2">
                  Try a different purpose, venue or group size. For a larger group, view a venue’s
                  catalog and send an enquiry.
                </p>
                <Link to="/$brand" params={{ brand: "enigma" }} className="mr-4 underline">
                  Enigma catalog
                </Link>
                <Link to="/$brand" params={{ brand: "studio-d" }} className="underline">
                  Studio D catalog
                </Link>
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((service) => {
                const photo = servicePhoto(service);
                const checked = selected.some((item) => item.id === service.id);
                return (
                  <article
                    key={service.id}
                    className="surface-panel flex min-w-0 flex-col overflow-hidden"
                  >
                    <VenueImage
                      photo={photo}
                      alt={service.imageAlt}
                      className="h-48 rounded-none"
                    />
                    {photo?.caption && (
                      <p className="px-5 pt-2 text-xs text-muted-foreground">{photo.caption}</p>
                    )}
                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <p className="text-xs font-semibold uppercase">
                        {service.brand === "enigma" ? "Enigma" : "Studio D"} ·{" "}
                        {purposes[spacePurpose(service)!]}
                      </p>
                      <h2 className="text-xl font-semibold">{service.name}</h2>
                      <p className="text-sm text-muted-foreground">{service.useCase}</p>
                      <p className="text-sm">
                        Listed capacity: up to {service.maxAttendees} · subject to confirmation
                      </p>
                      <div className="text-sm">
                        <Prices service={service} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {catalog.data?.ready &&
                        service.bookableHourly &&
                        service.status === "published"
                          ? "Hourly reservation requests available; staff approval required."
                          : "Enquiries welcome · online reservations pending approval."}
                      </p>
                      <div className="mt-auto space-y-3 pt-2">
                        <DetailsLink service={service} />
                        <label className="flex min-h-11 items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && selected.length === 3}
                            onChange={() => toggle(service)}
                          />
                          Compare<span className="sr-only"> {service.name}</span>
                        </label>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
        {selected.length > 0 && (
          <section id="comparison" aria-label="Space comparison" className="mt-10 scroll-mt-40">
            <h2 className="text-2xl font-bold">Compare your spaces</h2>
            <p className="my-3 text-sm">
              {selected.length < 2 ? "Select another space to compare. " : ""}On smaller screens,
              swipe across the comparison. Prices keep their published billing periods; missing
              prices are not zero.
            </p>
            <div
              className="relative overflow-x-auto rounded border"
              role="region"
              aria-label="Comparison table"
              tabIndex={0}
            >
              <table className="w-full min-w-[680px] text-left text-sm">
                <caption className="sr-only">
                  Selected spaces and their listed details, subject to venue confirmation
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-4">
                      Details
                    </th>
                    {selected.map((service) => (
                      <th scope="col" key={service.id} className="min-w-56 p-4">
                        <VenueImage
                          photo={servicePhoto(service)}
                          alt={service.imageAlt}
                          className="mb-3 h-28"
                        />
                        {servicePhoto(service)?.caption && (
                          <p className="mb-2 text-xs font-normal">
                            {servicePhoto(service)?.caption}
                          </p>
                        )}
                        <p>{service.name}</p>
                        <p className="font-normal">
                          {service.brand === "enigma" ? "Enigma" : "Studio D"}
                        </p>
                        <button
                          className="mt-2 min-h-11 underline"
                          onClick={() => toggle(service)}
                          aria-label={`Remove ${service.name} from comparison`}
                        >
                          Remove
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "Listed capacity (confirm)",
                      render: (s: Service) => `Up to ${s.maxAttendees}`,
                    },
                    {
                      label: "Published prices (JMD)",
                      render: (s: Service) => <Prices service={s} />,
                    },
                    {
                      label: "Listed inclusions (confirm)",
                      render: (s: Service) =>
                        s.content.included.length ? (
                          <ul className="list-inside list-disc space-y-1">
                            {s.content.included.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          "Pending venue confirmation"
                        ),
                    },
                    {
                      label: "Not included",
                      render: (s: Service) =>
                        s.content["not-included"].join(" · ") || "Pending venue confirmation",
                    },
                    {
                      label: "Bring with you",
                      render: (s: Service) =>
                        s.content.bring.join(" · ") || "Pending venue confirmation",
                    },
                    {
                      label: "Accessibility / facilities",
                      render: (s: Service) => s.facilitiesStatus || "Pending venue confirmation",
                    },
                    { label: "Next step", render: (s: Service) => <DetailsLink service={s} /> },
                  ].map((row) => (
                    <tr key={row.label} className="border-t">
                      <th scope="row" className="p-4 align-top">
                        {row.label}
                      </th>
                      {selected.map((s) => (
                        <td key={s.id} className="p-4 align-top">
                          {row.render(s)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {selected.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-center gap-3 border-t bg-background p-3 shadow-lg">
            <p className="text-sm">
              {selected.length}/3 selected{selected.length === 3 ? " · remove one to change" : ""}
            </p>
            <Button asChild>
              <a href="#comparison">Compare selected spaces</a>
            </Button>
            <Button variant="outline" onClick={() => update({ compare: undefined })}>
              Clear comparison
            </Button>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
