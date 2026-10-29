import type { BrandSlug, Service } from "@/data/catalog";

export interface VenuePhoto {
  src: string;
  alt: string;
  caption?: string;
}
const photo = (file: string, alt: string): VenuePhoto => ({ src: `/images/venues/${file}`, alt });
const meeting = photo(
  "enigma-meeting.jpg",
  "Enigma meeting room with a table, blue chairs and wall display",
);
const office = photo("enigma-office.jpg", "Private office pictured on Enigma’s pricing page");
const lounge = photo(
  "enigma-lounge.jpg",
  "Enigma Cooler lounge with yellow seating and a shared table",
);
const hotDesk = photo("enigma-hot-desk.jpg", "Shared desks and yellow chairs in Enigma’s Sandbox");
const dedicatedDesk = photo(
  "enigma-dedicated-desk.jpg",
  "Desks, yellow chairs and storage at Enigma",
);
const sleeper = photo(
  "enigma-sleeper-pod.jpg",
  "Padded sleeper pod pictured on Enigma’s pricing page",
);
const privatePod = photo(
  "enigma-private-pod.jpg",
  "Enigma’s enclosed private pods beside the workspace",
);
const lockers = photo("enigma-lockers.jpg", "Storage lockers alongside Enigma’s shared workspace");
const studio = photo("studio-7209.webp", "Studio D’s open studio floor and acoustic feature wall");
const studioLounge: VenuePhoto = {
  ...photo("studio-lounge.jpg", "Studio D lounge architectural rendering with counter seating"),
  caption: "Lounge rendering from Studio D’s website.",
};

// Photos are matched to the published source sections, not used to approve
// inventory, capacity, included equipment or reservation rules.
export const brandPhotos: Record<BrandSlug, { cover: VenuePhoto; gallery: VenuePhoto[] }> = {
  enigma: {
    cover: hotDesk,
    gallery: [meeting, office, lounge, dedicatedDesk, sleeper, privatePod, lockers],
  },
  "studio-d": {
    cover: studio,
    gallery: [
      photo("studio-7253.webp", "Another view of Studio D’s open floor and seating area"),
      photo("studio-7221.webp", "Studio D table and chairs in front of the branded acoustic wall"),
      photo("studio-7304.webp", "Studio D’s branded acoustic wall and meeting table"),
      photo("studio-7265.webp", "Studio D window-side counter and seating"),
      photo("studio-7289.webp", "Studio D corridor and interior rooms"),
      photo("studio-7222.webp", "Small room with a desk and screen in Studio D’s website gallery"),
    ],
  },
};
const servicePhotos: Record<string, VenuePhoto> = {
  "svc-enigma-meeting": meeting,
  "svc-enigma-hot-desk": hotDesk,
  "svc-enigma-desk": dedicatedDesk,
  "svc-enigma-private-office-one": office,
  "svc-enigma-private-office-two": office,
  "svc-enigma-lounge-single": lounge,
  "svc-enigma-lounge-max": lounge,
  "svc-enigma-sleeper-pod": sleeper,
  "svc-enigma-private-pod": privatePod,
  "svc-enigma-locker": lockers,
  "svc-studio-rental": studio,
  "svc-studio-lounge": studioLounge,
};
export function servicePhoto(service: Service): VenuePhoto | undefined {
  // A staff-uploaded photo always takes precedence over the website fallback.
  return service.imageUrl
    ? { src: service.imageUrl, alt: service.imageAlt }
    : servicePhotos[service.id];
}
