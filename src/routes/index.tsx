import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/site-chrome";
import { ImagePlaceholder } from "@/components/demo-banner";
import { Button } from "@/components/ui/button";
import { brands, servicesForBrand, VENUE_TIMEZONE_LABEL } from "@/data/demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Enigma + Studio D — Book rooms, desks and studio time" },
      {
        name: "description",
        content: "Choose a space at Enigma or Studio D, pick a time and reserve it online.",
      },
      { property: "og:title", content: "Enigma + Studio D — Book rooms, desks and studio time" },
      {
        property: "og:description",
        content: "Choose a space at Enigma or Studio D, pick a time and reserve it online.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:pt-16">
        <p className="text-sm font-medium text-muted-foreground">Two spaces, one booking</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Book a room, a desk or the studio — by the hour.
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          See exactly what is included and what to bring before you reserve. All times are in{" "}
          {VENUE_TIMEZONE_LABEL}.
        </p>
      </section>
      <section className="mx-auto grid max-w-7xl gap-6 px-4 md:grid-cols-2">
        {brands.map((b) => {
          const list = servicesForBrand(b.slug);
          return (
            <article key={b.slug} className="surface-panel overflow-hidden">
              <ImagePlaceholder alt={`${b.name} space`} className="h-56 rounded-none" />
              <div className="space-y-3 p-6">
                <h2 className={`text-2xl font-semibold ${b.accentClass}`}>{b.name}</h2>
                <p className="text-muted-foreground">{b.description}</p>
                <ul className="flex flex-wrap gap-2 text-sm">
                  {list.map((s) => (
                    <li key={s.id} className="rounded-full bg-muted px-3 py-1">
                      {s.name}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-2">
                  <Link to="/$brand" params={{ brand: b.slug }}>
                    See {b.name} spaces <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </article>
          );
        })}
      </section>
    </SiteLayout>
  );
}
