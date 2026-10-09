import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout, PageHeading } from "@/components/site-chrome";
import { backendConfigured, rpc } from "@/lib/supabase";
import type { Policy } from "@/lib/booking";
export const Route = createFileRoute("/policies")({ component: Policies });
function Policies() {
  const q = useQuery({
    queryKey: ["policies"],
    queryFn: () => (backendConfigured ? rpc<Policy[]>("public_policies") : Promise.resolve([])),
  });
  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <PageHeading
          title="Policies"
          description="Review the venue policies before requesting a reservation."
        />
        {q.isLoading && <p role="status">Loading policies?</p>}
        {q.error && <p role="alert">{q.error.message}</p>}
        {!q.isLoading && !q.data?.length && (
          <p className="mt-6">
            Policies await business approval. Reservations remain unavailable until the policies are
            published.
          </p>
        )}
        <div className="mt-8 space-y-4">
          {q.data?.map((p) => (
            <section key={p.id} className="surface-panel p-5">
              <h2 className="font-semibold">{p.title}</h2>
              <p className="text-xs text-muted-foreground">Version {p.version}</p>
              <p className="mt-2 whitespace-pre-wrap">{p.body}</p>
            </section>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
