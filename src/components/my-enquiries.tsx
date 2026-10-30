import { EnquiryProgress } from "@/components/enquiry-progress";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { db } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useCatalog } from "@/hooks/use-catalog";
import { enquiryStates } from "@/lib/enquiries";

export function MyEnquiries() {
  const auth = useAuth();
  const qc = useQueryClient();
  const catalog = useCatalog();
  const query = useQuery({
    queryKey: ["my-enquiries", auth.user?.id],
    enabled: !!auth.user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await db()
        .from("enquiries")
        .select("*")
        .eq("customer_id", auth.user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <section id="enquiries" aria-label="My enquiries" className="scroll-mt-40 space-y-3">
      <h2 className="text-xl font-semibold">My enquiries</h2>
      <p className="text-sm">
        Check progress here while email notifications are pending. An enquiry or quote does not
        reserve a space.
      </p>
      <button
        className="min-h-11 underline"
        onClick={() => {
          void query.refetch();
          void qc.invalidateQueries({ queryKey: ["enquiry-progress"] });
        }}
      >
        Refresh enquiries
      </button>
      {query.isLoading ? (
        <p role="status">Loading enquiries…</p>
      ) : query.error ? (
        <p role="alert">Could not load enquiries. Please refresh to try again.</p>
      ) : !query.data?.length ? (
        <p>
          No enquiries linked to your account yet.{" "}
          <Link to="/spaces" className="underline">
            Find a space
          </Link>
          . If you enquired as a guest, ask staff to link your verified account.
        </p>
      ) : (
        query.data.map((enquiry) => {
          const status = enquiryStates[enquiry.state as keyof typeof enquiryStates];
          const service = catalog.data?.services.find((item) => item.id === enquiry.service_id);
          return (
            <div
              key={enquiry.id}
              className="surface-panel min-w-0 space-y-4 rounded-2xl p-4 sm:p-5"
            >
              <p className="font-semibold">
                {service?.name ?? "Space enquiry"} · {status?.label ?? enquiry.state}
              </p>
              <p className="break-all text-sm">Reference: ENQ-{enquiry.id}</p>
              <p>
                {String(enquiry.start_date).slice(0, 10)} – {String(enquiry.end_date).slice(0, 10)}{" "}
                · {enquiry.rental_period} · {enquiry.attendees} attendees
              </p>
              <p className="text-sm">{status?.description}</p>
              {enquiry.state === "quoted" && (
                <a href="#rental-quotes" className="inline-block underline">
                  Review rental quotes and their current status
                </a>
              )}
              <EnquiryProgress
                enquiryId={enquiry.id}
                state={enquiry.state}
                createdAt={enquiry.created_at}
              />
              <details className="rounded-xl border p-3">
                <summary className="cursor-pointer">Your enquiry details</summary>
                <p className="whitespace-pre-wrap break-words pt-2">
                  {enquiry.message || "No additional requirements supplied."}
                </p>
                <p className="mt-3 break-words text-sm">
                  {enquiry.contact_name} · {enquiry.email} · {enquiry.phone}
                </p>
              </details>
            </div>
          );
        })
      )}
    </section>
  );
}
