import { backendConfigured, rpc } from "@/lib/supabase";
import type { Catalog } from "@/hooks/use-catalog";
import { useCatalog } from "@/hooks/use-catalog";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeading, SiteLayout } from "@/components/site-chrome";
import { ServiceCard } from "@/components/booking-pieces";
import { getBrand } from "@/data/catalog";
import { brandPhotos } from "@/data/venue-media";
import { VenueImage } from "@/components/venue-image";

export const Route = createFileRoute("/$brand/")({
  loader: async ({ params }) => {
    const catalog = backendConfigured ? await rpc<Catalog>("public_catalog") : null;
    const brand = catalog
      ? catalog.brands.find((b) => b.slug === params.brand)
      : getBrand(params.brand);
    if (!brand) throw notFound();
    return { brand };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.brand.name} — Spaces to book`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.brand.description },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.brand.description },
      ],
    };
  },
  component: BrandPage,
});

function BrandPage() {
  const initial = Route.useLoaderData();
  const catalog = useCatalog();
  const brand = catalog.data?.brands.find((b) => b.slug === initial.brand.slug) ?? initial.brand;
  const list = catalog.data?.services.filter((s) => s.brand === brand.slug) ?? [];
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-12">
        <PageHeading eyebrow={brand.tagline} title={brand.name} description={brand.description} />
        <p className="mt-2 text-sm text-muted-foreground">{brand.addressStatus}</p>
        <section className="mt-8" aria-label={`${brand.name} photo gallery`}>
          <VenueImage
            photo={brandPhotos[brand.slug].cover}
            alt={`${brand.name} interior`}
            className="h-64 rounded-xl sm:h-96"
            eager
          />
          <div className="mt-3 flex gap-3 overflow-x-auto pb-3">
            {brandPhotos[brand.slug].gallery.map((photo) => (
              <VenueImage
                key={photo.src}
                photo={photo}
                alt={photo.alt}
                className="h-32 !w-52 shrink-0 rounded-lg"
              />
            ))}
          </div>
        </section>
        {catalog.isLoading && <p role="status">Loading spaces…</p>}
        {catalog.error && <p role="alert">{catalog.error.message}</p>}
        {!catalog.isLoading && !list.length && (
          <p className="mt-6">The service catalog is awaiting venue setup.</p>
        )}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
