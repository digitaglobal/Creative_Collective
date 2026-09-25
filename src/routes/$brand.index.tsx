import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeading, SiteLayout } from "@/components/site-chrome";
import { ServiceCard } from "@/components/booking-pieces";
import { getBrand, servicesForBrand } from "@/data/demo";

export const Route = createFileRoute("/$brand/")({
  loader: ({ params }) => {
    const brand = getBrand(params.brand);
    if (!brand) throw notFound();
    return { brand };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
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
  const { brand } = Route.useLoaderData();
  const list = servicesForBrand(brand.slug, true);
  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-12">
        <PageHeading eyebrow={brand.tagline} title={brand.name} description={brand.description} />
        <p className="mt-2 text-sm text-muted-foreground">{brand.addressStatus}</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
