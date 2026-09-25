import { createFileRoute } from "@tanstack/react-router";
import { PageHeading, SiteLayout } from "@/components/site-chrome";

export const Route = createFileRoute("/policies")({
  head: () => ({
    meta: [
      { title: "Policies — Enigma + Studio D" },
      { name: "description", content: "Cancellation, no-show and refund policies." },
      { property: "og:title", content: "Policies — Enigma + Studio D" },
      { property: "og:description", content: "Cancellation, no-show and refund policies." },
    ],
  }),
  component: Policies,
});

const sections = ["Cancellations", "No-shows", "Refunds", "Late arrival", "House rules"];

function Policies() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <PageHeading title="Policies" description="These policies have not been approved yet and are shown as placeholders." />
        <div className="mt-8 space-y-4">
          {sections.map((s) => (
            <section key={s} className="surface-panel p-5">
              <h2 className="font-semibold">{s}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Wording pending approval by the business.</p>
            </section>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
