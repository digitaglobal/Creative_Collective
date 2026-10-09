import { useCatalog } from "@/hooks/use-catalog";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/site-chrome";
import { ImagePlaceholder } from "@/components/demo-banner";
import { Button } from "@/components/ui/button";
import { brands as fallbackBrands, VENUE_TIMEZONE_LABEL } from "@/data/catalog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Creative Collective — Book workspace and studio time" },
      {
        name: "description",
        content: "Choose a space at Enigma or Studio D, pick a time and reserve it online.",
      },
      { property: "og:title", content: "Creative Collective — Book workspace and studio time" },
      {
        property: "og:description",
        content: "Choose a space at Enigma or Studio D, pick a time and reserve it online.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const catalog = useCatalog();
  const brands = catalog.data?.brands.length ? catalog.data.brands : fallbackBrands;
  return (
    <SiteLayout>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
        <div className="flex flex-col justify-center py-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">
            Workspace · production · community
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
            Where ideas{" "}
            <span className="decoration-primary decoration-8 underline underline-offset-4">
              come to life.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Creative Collective brings Enigma and Studio D together: a place to plan, make, and
            share your next big idea.
          </p>
          <div className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground">
            <span className="size-2 rounded-full bg-primary" />
            Book your space in {VENUE_TIMEZONE_LABEL}
          </div>
        </div>
        <div className="relative min-h-64 overflow-hidden rounded-lg bg-foreground p-7 text-background sm:min-h-80 sm:p-10">
          <div
            aria-hidden="true"
            className="absolute -right-14 -top-16 size-64 rounded-full bg-primary sm:size-80"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-32 -left-16 size-72 rounded-full border-[40px] border-background/10"
          />
          <div className="relative flex h-full min-h-52 flex-col justify-between sm:min-h-60">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-background/65">
              One creative home
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="border-t border-background/30 pt-3">
                <p className="text-2xl font-extrabold">Enigma</p>
                <p className="mt-1 text-sm text-background/65">Space to focus and connect</p>
              </div>
              <div className="border-t border-background/30 pt-3">
                <p className="text-2xl font-extrabold">Studio D</p>
                <p className="mt-1 text-sm text-background/65">Space to create and produce</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 pb-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Find your space
            </p>
            <h2 className="mt-1 text-3xl font-extrabold sm:text-4xl">Make room for what’s next.</h2>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            Choose a destination to explore spaces and book a time.
          </p>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-5 px-4 md:grid-cols-2">
        {brands.map((b) => {
          const list = catalog.data?.services.filter((s) => s.brand === b.slug) ?? [];
          return (
            <article key={b.slug} className="group surface-panel overflow-hidden">
              <div className="relative">
                <ImagePlaceholder
                  alt={`${b.name} space`}
                  className={`h-56 rounded-none ${b.slug === "enigma" ? "bg-brand-enigma" : "bg-brand-studio-d"}`}
                />
                <p className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em]">
                  A Creative Collective brand
                </p>
              </div>
              <div className="space-y-3 p-6 sm:p-7">
                <h2 className={`text-3xl font-extrabold ${b.accentClass}`}>{b.name}</h2>
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
