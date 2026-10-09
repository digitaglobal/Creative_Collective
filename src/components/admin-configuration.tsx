import {
  ConfigurationEditor,
  type ConfigRecord,
  type Choices,
} from "@/components/configuration-editor";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, rpc } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

const tables = [
  "settings",
  "brands",
  "services",
  "resources",
  "service_resources",
  "extra_resources",
  "closures",
  "policies",
] as const;
type Table = (typeof tables)[number];
const sectionNames: Record<Table, string> = {
  settings: "Booking rules and tax",
  brands: "Venue information",
  services: "Services and extras",
  resources: "Physical spaces and equipment",
  service_resources: "Service space allocations",
  extra_resources: "Extra equipment allocations",
  closures: "Closures",
  policies: "Policies",
};
export function AdminConfiguration() {
  const [table, setTable] = useState<Table>("settings");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["configuration", table],
    queryFn: async () => {
      const { data, error } = await db().from(table).select("*");
      if (error) throw error;
      return data;
    },
  });
  const sources = useQuery({
    queryKey: ["configuration-choices"],
    queryFn: async () => {
      const [services, resources, profiles] = await Promise.all([
        db().from("services").select("*"),
        db().from("resources").select("*"),
        db().from("profiles").select("*"),
      ]);
      for (const result of [services, resources, profiles]) if (result.error) throw result.error;
      return { services: services.data!, resources: resources.data!, profiles: profiles.data! };
    },
  });
  const choices: Choices = {
    brand: [
      { value: "enigma", label: "Enigma" },
      { value: "studio-d", label: "Studio D" },
    ],
    service_id: sources.data?.services.map((s) => ({ value: s.id, label: s.document.name })) ?? [],
    resource_id: [
      { value: "", label: "Entire venue (closures only)" },
      ...(sources.data?.resources.map((r) => ({ value: r.id, label: r.name })) ?? []),
    ],
    extra_id:
      sources.data?.services.flatMap((s) =>
        s.document.addons.map((a: { id: string; name: string }) => ({
          value: a.id,
          label: s.document.name + " - " + a.name,
        })),
      ) ?? [],
  };
  const run = async (action: () => Promise<void | string>) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await action();
      await qc.invalidateQueries();
      setMessage(result || "Saved.");
      setDraft("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="surface-panel space-y-4 p-5">
      <h2 className="text-xl font-semibold">Administrator configuration</h2>
      <p>
        Catalog proposals start unapproved. Review resources, prices, policies, tax and arrival
        information before enabling reservations. A tax rate of 0 must be an explicit business
        decision.
      </p>
      <label>
        Manage{" "}
        <select
          value={table}
          onChange={(e) => {
            setTable(e.target.value as Table);
            setDraft("");
          }}
          className="rounded border bg-background p-2"
        >
          {tables.map((t) => (
            <option key={t} value={t}>
              {sectionNames[t]}
            </option>
          ))}
        </select>
      </label>
      {q.error && <p role="alert">{q.error.message}</p>}
      {sources.error && <p role="alert">{sources.error.message}</p>}
      <div className="max-h-96 overflow-auto">
        {q.data?.map((row, i) => (
          <button
            key={i}
            className="mb-2 block w-full rounded border p-2 text-left"
            onClick={() =>
              setDraft(
                JSON.stringify(
                  table === "brands"
                    ? {
                        ...row,
                        document: {
                          arrivalInstructions: "",
                          contactEmail: "",
                          contactPhone: "",
                          ...row.document,
                        },
                      }
                    : table === "services"
                      ? { ...row, document: { acknowledgement: "", ...row.document } }
                      : row,
                  null,
                  2,
                ),
              )
            }
          >
            <span>
              {row.document?.name ||
                row.name ||
                row.title ||
                row.reason ||
                choices["service_id"]?.find((c) => c.value === row.service_id)?.label ||
                "Booking settings"}
              {row.resource_id && (
                <span>
                  {" "}
                  - {choices["resource_id"]?.find((c) => c.value === row.resource_id)?.label}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      {!["settings", "brands", "policies"].includes(table) && (
        <Button
          variant="outline"
          onClick={() => {
            const sample = sources.data?.services[0];
            const id = crypto.randomUUID();
            const row =
              table === "resources"
                ? { id: "res-" + id, brand: "enigma", name: "", approved: false }
                : table === "services"
                  ? {
                      id: "svc-" + id,
                      brand: "enigma",
                      slug: "new-service",
                      approved: false,
                      document: {
                        ...sample?.document,
                        id: "svc-" + id,
                        brand: "enigma",
                        slug: "new-service",
                        name: "New service",
                        description: "",
                        useCase: "",
                        resourceIds: [],
                        hourlyRateMinor: null,
                        publishedPrices: [],
                        addons: [],
                        status: "draft",
                        content: { included: [], "not-included": [], bring: [] },
                      },
                    }
                  : table === "closures"
                    ? { id, resource_id: null, starts_at: "", ends_at: "", reason: "" }
                    : {
                        service_id: null,
                        resource_id: null,
                        ...(table === "extra_resources" ? { extra_id: null } : {}),
                      };
            setDraft(JSON.stringify(row));
          }}
        >
          Add new
        </Button>
      )}
      {draft && (
        <ConfigurationEditor
          key={table + draft}
          record={JSON.parse(draft) as ConfigRecord}
          choices={choices}
          busy={busy}
          save={(row) =>
            run(async () => {
              const { error } = await db().from(table).upsert(row);
              if (error) throw error;
            })
          }
        />
      )}
      {draft && ["service_resources", "extra_resources", "closures"].includes(table) && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const row = JSON.parse(draft);
              const keys =
                table === "service_resources"
                  ? ["service_id", "resource_id"]
                  : table === "extra_resources"
                    ? ["service_id", "extra_id", "resource_id"]
                    : ["id"];
              let request = db().from(table).delete();
              for (const key of keys) {
                if (!row[key]) throw new Error("Select a saved record first.");
                request = request.eq(key, row[key]);
              }
              const { error } = await request;
              if (error) throw error;
            })
          }
        >
          Remove selected allocation or closure
        </Button>
      )}
      <form
        className="space-y-3 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            await rpc("set_role", { p_user: f.get("user"), p_role: f.get("role") });
          });
        }}
      >
        <h3 className="font-semibold">Account roles</h3>
        <label className="block">
          Account
          <select name="user" required className="ml-2 rounded border bg-background p-2">
            {sources.data?.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} - {p.phone}
              </option>
            ))}
          </select>
        </label>
        <label>
          Role
          <select name="role">
            <option>customer</option>
            <option>staff</option>
            <option>administrator</option>
          </select>
        </label>
        <Button disabled={busy}>Update role</Button>
      </form>
      <form
        className="space-y-3 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            const service = sources.data?.services.find((s) => s.id === f.get("service"));
            if (!service) throw new Error("Choose a service.");
            const file = f.get("photo") as File;
            if (!file?.size) throw new Error("Choose a photograph.");
            const path = `${crypto.randomUUID()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
            const { error } = await db().storage.from("venue-photos").upload(path, file);
            if (error) throw error;
            const url = db().storage.from("venue-photos").getPublicUrl(path).data.publicUrl;
            const update = await db()
              .from("services")
              .update({ document: { ...service.document, imageUrl: url } })
              .eq("id", service.id);
            if (update.error) throw update.error;
            return "Photo uploaded and saved to the service.";
          }).then(() => undefined);
        }}
      >
        <label className="block">
          Service
          <select name="service" required className="ml-2 rounded border bg-background p-2">
            {sources.data?.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.document.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Venue photograph
          <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required />
        </label>
        <Button disabled={busy}>Upload photo</Button>
      </form>
      {message && (
        <p role="status" className="break-all">
          {message}
        </p>
      )}
    </section>
  );
}
