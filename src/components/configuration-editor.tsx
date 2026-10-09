import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseMoneyMinor } from "@/lib/money";

export type ConfigValue =
  string | number | boolean | null | ConfigValue[] | { [key: string]: ConfigValue };
export type ConfigRecord = { [key: string]: ConfigValue };
export type Choices = Record<string, { value: string; label: string }[]>;
const labels: Record<string, string> = {
  name: "Name",
  slug: "URL name",
  brand: "Venue",
  service_id: "Service",
  resource_id: "Allocated space or equipment",
  extra_id: "Extra",
  document: "Details",
  approved: "Business approved",
  launch_approved: "Enable reservations (business approved)",
  tax_basis_points: "Approved tax rate (%)",
  hourlyRateMinor: "Hourly rate (JMD)",
  amountMinor: "Price (JMD)",
  maxAttendees: "Maximum attendees",
  minDurationMinutes: "Minimum duration (minutes)",
  maxDurationMinutes: "Maximum duration (minutes)",
  stepMinutes: "Time increments (minutes)",
  bookableHourly: "Allow hourly reservations",
  publishedPrices: "Published prices",
  addons: "Extras",
  content: "Service inclusions",
  included: "Included",
  "not-included": "Not included",
  bring: "What to bring",
  facilitiesStatus: "Facilities and accessibility",
  imageAlt: "Photo description",
  acknowledgement: "Required customer acknowledgement",
  arrivalInstructions: "Arrival instructions",
  addressStatus: "Address",
  body: "Policy wording",
  version: "Policy version",
  advance_notice_hours: "Advance notice (hours)",
  horizon_days: "Booking horizon (days)",
  hold_minutes: "Future payment hold (minutes)",
  buffer_minutes: "Setup buffer (minutes)",
  weekday_open: "Weekday opening",
  weekday_close: "Weekday closing",
  saturday_open: "Saturday opening",
  saturday_close: "Saturday closing",
  sunday_closed: "Closed Sunday",
  starts_at: "Start (Jamaica time)",
  ends_at: "End (Jamaica time)",
  status: "Publication",
  basis: "Charged",
  reason: "Reason",
  tagline: "Tagline",
  description: "Description",
  useCase: "Best suited for",
  label: "Rental period",
};
const hidden = new Set([
  "id",
  "resourceIds",
  "online_payments_enabled",
  "accentClass",
  "imageUrl",
  "draftReason",
  "currency",
  "timezone",
]);
const multiline = new Set(["body", "description", "arrivalInstructions", "acknowledgement"]);
export function ConfigurationEditor({
  record,
  save,
  busy,
  choices,
}: {
  record: ConfigRecord;
  save: (row: ConfigRecord) => Promise<void>;
  busy: boolean;
  choices: Choices;
}) {
  const [draft, setDraft] = useState(record);
  const [error, setError] = useState("");
  const update = (path: (string | number)[], value: ConfigValue) => {
    setDraft((previous) => {
      const copy = structuredClone(previous);
      let cursor: ConfigValue = copy;
      for (const key of path.slice(0, -1)) cursor = (cursor as ConfigRecord)[key]!;
      (cursor as ConfigRecord)[path.at(-1)!] = value;
      return copy;
    });
  };
  return (
    <form
      className="space-y-3 rounded border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        try {
          const row = structuredClone(draft);
          if (
            row["document"] &&
            typeof row["document"] === "object" &&
            !Array.isArray(row["document"])
          ) {
            const doc = row["document"] as ConfigRecord;
            if (row["brand"]) doc["id"] = row["id"]!;
            if (row["brand"]) doc["brand"] = row["brand"]!;
            if (row["slug"]) doc["slug"] = row["slug"]!;
          }
          void save(row);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Check your fields");
        }
      }}
    >
      <Fields value={draft} path={[]} update={update} choices={choices} />
      <Button disabled={busy}>Save configuration</Button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
function Fields({
  value,
  path,
  update,
  choices,
}: {
  value: ConfigRecord;
  path: (string | number)[];
  update: (p: (string | number)[], v: ConfigValue) => void;
  choices: Choices;
}) {
  return (
    <div className="space-y-3">
      {Object.entries(value)
        .filter(
          ([key]) =>
            !hidden.has(key) && !(path.includes("document") && ["slug", "brand"].includes(key)),
        )
        .map(([key, item]) => {
          const current = [...path, key];
          const label = labels[key] ?? key.replace(/_/g, " ");
          const style = "mt-1 w-full rounded border bg-background p-2";
          if (Array.isArray(item)) {
            if (["included", "not-included", "bring"].includes(key))
              return (
                <label key={key} className="block text-sm">
                  {label} (one per line)
                  <textarea
                    rows={3}
                    value={item.join("\n")}
                    onChange={(e) => update(current, e.target.value.split("\n"))}
                    className={style}
                  />
                </label>
              );
            return (
              <fieldset key={key} className="space-y-3 rounded border p-3">
                <legend>{label}</legend>
                {item.map((entry, i) =>
                  typeof entry === "object" && entry !== null && !Array.isArray(entry) ? (
                    <div key={i} className="space-y-2 rounded border p-3">
                      <Fields
                        value={entry}
                        path={[...current, i]}
                        update={update}
                        choices={choices}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          update(
                            current,
                            item.filter((_, j) => i !== j),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null,
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    update(current, [
                      ...item,
                      key === "addons"
                        ? {
                            id: `extra-${crypto.randomUUID()}`,
                            name: "",
                            description: "",
                            basis: "per-booking",
                            amountMinor: 0,
                            status: "draft",
                          }
                        : { label: "Daily", amountMinor: 0 },
                    ])
                  }
                >
                  Add {key === "addons" ? "extra" : "price"}
                </Button>
              </fieldset>
            );
          }
          if (typeof item === "object" && item !== null)
            return (
              <fieldset key={key} className="space-y-3 rounded border p-3">
                <legend>{label}</legend>
                <Fields value={item} path={current} update={update} choices={choices} />
              </fieldset>
            );
          if (typeof item === "boolean")
            return (
              <label key={key} className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item}
                  onChange={(e) => update(current, e.target.checked)}
                />
                {label}
              </label>
            );
          const options =
            choices[key] ??
            (key === "status"
              ? [
                  { value: "draft", label: "Draft" },
                  { value: "published", label: "Published" },
                ]
              : key === "basis"
                ? [
                    { value: "per-booking", label: "Per booking" },
                    { value: "per-hour", label: "Per hour" },
                  ]
                : null);
          if (options)
            return (
              <label key={key} className="block text-sm">
                {label}
                <select
                  value={String(item ?? "")}
                  onChange={(e) => update(current, e.target.value || null)}
                  className={style}
                >
                  <option value="">Choose…</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          if (multiline.has(key))
            return (
              <label key={key} className="block text-sm">
                {label}
                <textarea
                  value={String(item ?? "")}
                  rows={4}
                  onChange={(e) => update(current, e.target.value)}
                  className={style}
                />
              </label>
            );
          const money = ["amountMinor", "hourlyRateMinor", "tax_basis_points"].includes(key);
          const numeric = typeof item === "number" || money;
          const instant = ["starts_at", "ends_at"].includes(key);
          const display =
            instant && item
              ? new Date(new Date(String(item)).getTime() - 5 * 3600_000).toISOString().slice(0, 16)
              : money && item != null
                ? Number(item) / 100
                : (item ?? "");
          return (
            <label key={key} className="block text-sm">
              {label}
              <input
                type={
                  instant
                    ? "datetime-local"
                    : key.endsWith("_open") || key.endsWith("_close")
                      ? "time"
                      : numeric
                        ? "number"
                        : "text"
                }
                defaultValue={String(display)}
                step={numeric ? (money ? "0.01" : "1") : undefined}
                min={numeric ? 0 : undefined}
                onChange={(e) => {
                  if (instant) {
                    update(current, e.target.value ? e.target.value + ":00-05:00" : null);
                    return;
                  }
                  try {
                    update(
                      current,
                      numeric
                        ? e.target.value === ""
                          ? null
                          : money
                            ? parseMoneyMinor(e.target.value)
                            : Number(e.target.value)
                        : e.target.value,
                    );
                    e.target.setCustomValidity("");
                  } catch (err) {
                    e.target.setCustomValidity(
                      err instanceof Error ? err.message : "Invalid amount",
                    );
                    e.target.reportValidity();
                  }
                }}
                className={style}
              />
            </label>
          );
        })}
    </div>
  );
}
