import type { Service } from "@/data/catalog";

export const purposes = {
  workspace: "Desks & offices",
  meeting: "Meetings",
  studio: "Studio & shoots",
  recording: "Recording & podcasts",
  lounge: "Lounges & pods",
} as const;
export type Purpose = keyof typeof purposes;
const categories: Record<string, Purpose> = {
  "svc-enigma-hot-desk": "workspace",
  "svc-enigma-desk": "workspace",
  "svc-enigma-private-office-one": "workspace",
  "svc-enigma-private-office-two": "workspace",
  "svc-enigma-meeting": "meeting",
  "svc-enigma-booth": "recording",
  "svc-studio-recording-booth": "recording",
  "svc-studio-podcast": "recording",
  "svc-studio-rental": "studio",
  "svc-studio-lounge": "lounge",
  "svc-enigma-lounge-single": "lounge",
  "svc-enigma-lounge-max": "lounge",
  "svc-enigma-sleeper-pod": "lounge",
  "svc-enigma-private-pod": "lounge",
};
// Only explicitly identified spaces belong here; printing, lockers and equipment
// remain in each venue's full catalog, rather than being presented as rooms.
export function spacePurpose(service: Service): Purpose | undefined {
  return categories[service.id];
}
export function matchingSpaces(
  services: Service[],
  filters: {
    purpose?: string | undefined;
    venue?: string | undefined;
    people?: number | undefined;
  },
) {
  return services.filter(
    (service) =>
      spacePurpose(service) &&
      (!filters.purpose || spacePurpose(service) === filters.purpose) &&
      (!filters.venue || service.brand === filters.venue) &&
      (!filters.people || service.maxAttendees >= filters.people),
  );
}
export function comparisonSpaces(services: Service[], ids: string | undefined) {
  return [...new Set((ids ?? "").split(","))]
    .map((id) => services.find((service) => service.id === id && spacePurpose(service)))
    .filter((s): s is Service => Boolean(s))
    .slice(0, 3);
}
