/**
 * DEMO DATA — Milestone 1 only.
 *
 * Nothing here is approved business information. Prices, services, rooms,
 * hours and policies are proposals seeded for UI development. No real
 * customer contacts. Emails use the reserved example.invalid domain.
 * These proposals may be imported for review, but must be approved before launch.
 */

export const DEMO_MODE = import.meta.env.DEV && import.meta.env["VITE_DEMO_MODE"] === "true";

export const CURRENCY = "JMD";
export const VENUE_TIMEZONE = "America/Jamaica";
export const VENUE_TIMEZONE_LABEL = "Jamaica time (America/Jamaica)";

export type BrandSlug = "enigma" | "studio-d";

export interface Brand {
  slug: BrandSlug;
  name: string;
  tagline: string;
  description: string;
  addressStatus: string;
  accentClass: string;
  contactEmail?: string;
  contactPhone?: string;
  arrivalInstructions?: string;
}

export const brands: Brand[] = [
  {
    slug: "enigma",
    name: "Enigma",
    tagline: "Workspace, meeting rooms and a recording booth",
    description: "Desks, a meeting room and a recording booth for focused work and short sessions.",
    addressStatus: "Address and arrival instructions pending approval",
    accentClass: "text-brand-enigma",
  },
  {
    slug: "studio-d",
    name: "Studio D",
    tagline: "Creative studio space for shoots and podcasts",
    description:
      "A studio that can be booked as an open studio rental or as a podcast configuration.",
    addressStatus: "Address and arrival instructions pending approval",
    accentClass: "text-brand-studio-d",
  },
];

export function getBrand(slug: string): Brand | undefined {
  return brands.find((b) => b.slug === slug);
}

export interface Resource {
  id: string;
  brand: BrandSlug;
  name: string;
}

export const resources: Resource[] = [
  { id: "res-enigma-meeting", brand: "enigma", name: "Meeting room" },
  { id: "res-enigma-booth", brand: "enigma", name: "Recording booth" },
  { id: "res-enigma-desk-3", brand: "enigma", name: "Assigned desk 3" },
  { id: "res-studio-main", brand: "studio-d", name: "Main studio floor" },
];

export type ContentType = "included" | "not-included" | "bring";

export interface ServiceAddon {
  id: string;
  name: string;
  description: string;
  basis: "per-booking" | "per-hour";
  amountMinor: number;
  status: "published" | "draft";
  draftReason?: string;
}

export interface ServicePrice {
  label: string;
  amountMinor: number;
}

export interface Service {
  id: string;
  slug: string;
  brand: BrandSlug;
  name: string;
  useCase: string;
  description: string;
  /** Resources the service occupies. Two services can share one resource. */
  resourceIds: string[];
  maxAttendees: number;
  hourlyRateMinor: number | null;
  /** Public source rates by period; amounts use integer minor JMD units. */
  publishedPrices: ServicePrice[];
  bookableHourly: boolean;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  stepMinutes: number;
  status: "published" | "draft";
  draftReason?: string;
  acknowledgement?: string;
  content: Record<ContentType, string[]>;
  facilitiesStatus: string;
  addons: ServiceAddon[];
  imageAlt: string;
  imageUrl?: string;
}

/** Minor units: 500000 = JMD 5,000.00 */
export const services: Service[] = [
  {
    id: "svc-enigma-meeting",
    slug: "meeting-room",
    brand: "enigma",
    name: "Meeting room",
    useCase: "Team meetings, interviews and client sessions",
    description:
      "A closed room for small group meetings. Seats are arranged around one table with a wall-mounted display.",
    resourceIds: ["res-enigma-meeting"],
    maxAttendees: 8,
    hourlyRateMinor: 500000,
    publishedPrices: [
      { label: "Hourly", amountMinor: 500000 },
      { label: "Daily", amountMinor: 2500000 },
      { label: "Weekly", amountMinor: 7000000 },
      { label: "Monthly", amountMinor: 22500000 },
    ],
    bookableHourly: true,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Private room for your booked time", "Table and seating", "Wall display", "Wi-Fi"],
      "not-included": ["Catering", "Printing", "Technical support during the session"],
      bring: ["Your own laptop and display adapter", "Any presentation materials"],
    },
    facilitiesStatus: "Accessibility details not yet supplied by the business",
    addons: [
      {
        id: "add-meeting-setup",
        name: "Room re-arrangement",
        description: "Staff arrange the room in a requested layout before you arrive.",
        basis: "per-booking",
        amountMinor: 100000,
        status: "draft",
        draftReason: "Staff availability for this task is not confirmed",
      },
    ],
    imageAlt: "Enigma meeting room with a central table and wall display",
  },
  {
    id: "svc-enigma-booth",
    slug: "recording-booth",
    brand: "enigma",
    name: "Recording booth",
    useCase: "Voice notes, auditions and solo recording with your own gear",
    description:
      "A small treated booth for one person. It is a quiet room, not a fully equipped recording studio.",
    resourceIds: ["res-enigma-booth"],
    maxAttendees: 2,
    hourlyRateMinor: 500000,
    publishedPrices: [
      { label: "Hourly", amountMinor: 500000 },
      { label: "Daily", amountMinor: 2500000 },
    ],
    bookableHourly: true,
    minDurationMinutes: 60,
    maxDurationMinutes: 240,
    stepMinutes: 30,
    status: "published",
    acknowledgement:
      "I understand that the booth does not include a complete recording setup or an audio engineer unless explicitly listed in my booking.",
    content: {
      included: ["Quiet treated booth", "Desk, chair and power outlets", "Wi-Fi"],
      "not-included": [
        "A complete recording setup",
        "An audio engineer",
        "Mixing, mastering or editing",
        "Microphone provision is not confirmed and must not be assumed",
      ],
      bring: [
        "Your microphone, interface and cables",
        "Your laptop and recording software",
        "Headphones",
      ],
    },
    facilitiesStatus: "Equipment inventory pending review by the business",
    addons: [
      {
        id: "add-booth-engineer",
        name: "Recording engineer",
        description: "An engineer runs the session with you.",
        basis: "per-hour",
        amountMinor: 350000,
        status: "draft",
        draftReason: "Not confirmed as an offered service; personnel availability not modelled",
      },
    ],
    imageAlt: "Enigma recording booth with acoustic treatment and a desk",
  },
  {
    id: "svc-enigma-desk",
    slug: "assigned-desk",
    brand: "enigma",
    name: "Assigned desk",
    useCase: "A single named desk for focused individual work",
    description:
      "One specific desk reserved for you. Each desk is booked individually; there is no shared seat pool at launch.",
    resourceIds: ["res-enigma-desk-3"],
    maxAttendees: 1,
    hourlyRateMinor: 125000,
    publishedPrices: [
      { label: "Hourly", amountMinor: 125000 },
      { label: "Daily", amountMinor: 675000 },
      { label: "Weekly", amountMinor: 2000000 },
      { label: "Monthly", amountMinor: 4350000 },
    ],
    bookableHourly: true,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["One named desk", "Chair and power", "Wi-Fi"],
      "not-included": ["Storage or lockers", "Meeting room access", "Printing"],
      bring: ["Your laptop", "Headphones for calls"],
    },
    facilitiesStatus: "Number of bookable desks pending confirmation",
    addons: [],
    imageAlt: "A single assigned desk in the Enigma workspace",
  },
  {
    id: "svc-enigma-private-office-one",
    slug: "private-office-one-seater",
    brand: "enigma",
    name: "Private office — one seater",
    useCase: "Private workspace with storage",
    description:
      "One-seater private office with storage. Monthly and longer period rates are listed for reference; online reservations are hourly only.",
    resourceIds: [],
    maxAttendees: 1,
    hourlyRateMinor: 275000,
    publishedPrices: [
      { label: "Hourly", amountMinor: 275000 },
      { label: "Daily", amountMinor: 1500000 },
      { label: "Weekly", amountMinor: 3000000 },
      { label: "Monthly", amountMinor: 9000000 },
    ],
    bookableHourly: true,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Private one-seater office", "Storage"],
      "not-included": ["Tax"],
      bring: ["Your laptop and work materials"],
    },
    facilitiesStatus: "Confirm office availability with Enigma",
    addons: [],
    imageAlt: "Enigma one-seater private office",
  },
  {
    id: "svc-enigma-private-office-two",
    slug: "private-office-two-seater",
    brand: "enigma",
    name: "Private office — two seater",
    useCase: "Private workspace for two with storage",
    description:
      "Two-seater private office with storage. Monthly and longer period rates are listed for reference; online reservations are hourly only.",
    resourceIds: [],
    maxAttendees: 2,
    hourlyRateMinor: 412500,
    publishedPrices: [
      { label: "Hourly", amountMinor: 412500 },
      { label: "Daily", amountMinor: 2250000 },
      { label: "Weekly", amountMinor: 5250000 },
      { label: "Monthly", amountMinor: 12500000 },
    ],
    bookableHourly: true,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Private two-seater office", "Storage"],
      "not-included": ["Tax"],
      bring: ["Your laptop and work materials"],
    },
    facilitiesStatus: "Confirm office availability with Enigma",
    addons: [],
    imageAlt: "Enigma two-seater private office",
  },
  {
    id: "svc-enigma-lounge-single",
    slug: "lounge-single-seat",
    brand: "enigma",
    name: "Lounge — single seat",
    useCase: "A flexible seat in the lounge",
    description:
      "Single-seat lounge use. Published daily, weekly, and monthly rates are shown for reference.",
    resourceIds: [],
    maxAttendees: 1,
    hourlyRateMinor: 100000,
    publishedPrices: [
      { label: "Hourly", amountMinor: 100000 },
      { label: "Daily", amountMinor: 500000 },
      { label: "Weekly", amountMinor: 1500000 },
      { label: "Monthly", amountMinor: 3750000 },
    ],
    bookableHourly: true,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Lounge seating"],
      "not-included": ["Tax"],
      bring: ["Your work materials"],
    },
    facilitiesStatus: "Confirm lounge availability with Enigma",
    addons: [],
    imageAlt: "Enigma lounge seating",
  },
  {
    id: "svc-enigma-lounge-max",
    slug: "lounge-max-five-seats",
    brand: "enigma",
    name: "Lounge Max — 5 seats",
    useCase: "Lounge booking for up to five people",
    description:
      "Lounge booking for up to five seats. Published daily, weekly, and monthly rates are shown for reference.",
    resourceIds: [],
    maxAttendees: 5,
    hourlyRateMinor: 550000,
    publishedPrices: [
      { label: "Hourly", amountMinor: 550000 },
      { label: "Daily", amountMinor: 2500000 },
      { label: "Weekly", amountMinor: 7000000 },
      { label: "Monthly", amountMinor: 18000000 },
    ],
    bookableHourly: true,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Lounge seating for up to five"],
      "not-included": ["Tax"],
      bring: ["Your work materials"],
    },
    facilitiesStatus: "Confirm lounge availability with Enigma",
    addons: [],
    imageAlt: "Enigma lounge seating for a group",
  },
  {
    id: "svc-enigma-sleeper-pod",
    slug: "sleeper-pod",
    brand: "enigma",
    name: "Sleeper pod",
    useCase: "Private sleeper pod",
    description:
      "Personal sleeper pod. Enigma publishes hourly and daily rates; online booking is limited to hourly reservations.",
    resourceIds: [],
    maxAttendees: 1,
    hourlyRateMinor: 500000,
    publishedPrices: [
      { label: "Hourly", amountMinor: 500000 },
      { label: "Daily", amountMinor: 3000000 },
    ],
    bookableHourly: true,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Personal sleeper pod"],
      "not-included": ["Tax"],
      bring: ["Personal items"],
    },
    facilitiesStatus: "Confirm pod availability with Enigma",
    addons: [],
    imageAlt: "Enigma sleeper pod",
  },
  {
    id: "svc-enigma-private-pod",
    slug: "private-pod",
    brand: "enigma",
    name: "Private pod",
    useCase: "A private area for focused work",
    description: "Private area for focused work. Longer-period rates are listed for reference.",
    resourceIds: [],
    maxAttendees: 1,
    hourlyRateMinor: 300000,
    publishedPrices: [
      { label: "Hourly", amountMinor: 300000 },
      { label: "Daily", amountMinor: 1500000 },
      { label: "Weekly", amountMinor: 5000000 },
      { label: "Monthly", amountMinor: 10000000 },
    ],
    bookableHourly: true,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Private area"],
      "not-included": ["Tax"],
      bring: ["Your work materials"],
    },
    facilitiesStatus: "Confirm pod availability with Enigma",
    addons: [],
    imageAlt: "Enigma private pod",
  },
  {
    id: "svc-enigma-whiteboard",
    slug: "digital-whiteboard",
    brand: "enigma",
    name: "Digital whiteboard add-on",
    useCase: "Optional add-on for meeting room bookings",
    description:
      "Published whiteboard rates are available by period; this add-on is inquiry only until booking rules are confirmed.",
    resourceIds: [],
    maxAttendees: 8,
    hourlyRateMinor: null,
    publishedPrices: [
      { label: "Hourly", amountMinor: 250000 },
      { label: "Daily", amountMinor: 1650000 },
      { label: "Weekly", amountMinor: 5000000 },
      { label: "Monthly", amountMinor: 14500000 },
    ],
    bookableHourly: false,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: { included: ["Optional digital whiteboard"], "not-included": ["Tax"], bring: [] },
    facilitiesStatus: "Confirm with Enigma",
    addons: [],
    imageAlt: "Digital whiteboard add-on",
  },
  {
    id: "svc-enigma-locker",
    slug: "locker",
    brand: "enigma",
    name: "Locker",
    useCase: "Secure storage for personal belongings",
    description:
      "Locker rental. Longer period pricing is shown for reference; online booking is hourly only.",
    resourceIds: [],
    maxAttendees: 1,
    hourlyRateMinor: 50000,
    publishedPrices: [
      { label: "Hourly", amountMinor: 50000 },
      { label: "Daily", amountMinor: 250000 },
      { label: "Weekly", amountMinor: 750000 },
      { label: "Monthly", amountMinor: 2000000 },
    ],
    bookableHourly: true,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: { included: ["Single locker"], "not-included": ["Tax"], bring: [] },
    facilitiesStatus: "Confirm locker availability with Enigma",
    addons: [],
    imageAlt: "Enigma locker",
  },
  {
    id: "svc-enigma-printing",
    slug: "printing",
    brand: "enigma",
    name: "Printing",
    useCase: "Black and white or colour printing",
    description: "Per-page rates from Enigma; contact the team to arrange printing.",
    resourceIds: [],
    maxAttendees: 1,
    hourlyRateMinor: null,
    publishedPrices: [
      { label: "Letter — black & white", amountMinor: 5000 },
      { label: "Letter — colour", amountMinor: 12000 },
      { label: "Legal — black & white", amountMinor: 7000 },
      { label: "Legal — colour", amountMinor: 15000 },
    ],
    bookableHourly: false,
    minDurationMinutes: 60,
    maxDurationMinutes: 60,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Printing by request"],
      "not-included": ["Tax"],
      bring: ["Print-ready document"],
    },
    facilitiesStatus: "Confirm service availability with Enigma",
    addons: [],
    imageAlt: "Enigma printing service",
  },
  {
    id: "svc-enigma-stationery",
    slug: "envelopes",
    brand: "enigma",
    name: "Envelopes",
    useCase: "Medium and large envelopes",
    description: "Published envelope prices; contact Enigma to arrange purchase.",
    resourceIds: [],
    maxAttendees: 1,
    hourlyRateMinor: null,
    publishedPrices: [
      { label: "Medium", amountMinor: 3000 },
      { label: "Large", amountMinor: 5000 },
    ],
    bookableHourly: false,
    minDurationMinutes: 60,
    maxDurationMinutes: 60,
    stepMinutes: 30,
    status: "published",
    content: { included: ["Envelope by selected size"], "not-included": ["Tax"], bring: [] },
    facilitiesStatus: "Confirm availability with Enigma",
    addons: [],
    imageAlt: "Enigma stationery",
  },
  {
    id: "svc-enigma-beverages",
    slug: "beverages",
    brand: "enigma",
    name: "Beverages",
    useCase: "Water, coffee, or tea",
    description:
      "Enigma lists water and coffee at JMD 150 each; tea is mentioned but has no published price. Contact Enigma to order.",
    resourceIds: [],
    maxAttendees: 1,
    hourlyRateMinor: null,
    publishedPrices: [
      { label: "Water", amountMinor: 15000 },
      { label: "Coffee", amountMinor: 15000 },
    ],
    bookableHourly: false,
    minDurationMinutes: 60,
    maxDurationMinutes: 60,
    stepMinutes: 30,
    status: "published",
    content: { included: ["Order by request"], "not-included": ["Tax"], bring: [] },
    facilitiesStatus: "Tea price not published; confirm drink availability",
    addons: [],
    imageAlt: "Enigma beverages",
  },
  {
    id: "svc-enigma-equipment",
    slug: "macbook-rental",
    brand: "enigma",
    name: "MacBook Air 13-inch rental",
    useCase: "Hourly equipment rental",
    description:
      "Enigma lists this equipment rental at JMD 2,500 per hour; contact Enigma to arrange it.",
    resourceIds: [],
    maxAttendees: 1,
    hourlyRateMinor: null,
    publishedPrices: [{ label: "Per hour", amountMinor: 250000 }],
    bookableHourly: false,
    minDurationMinutes: 60,
    maxDurationMinutes: 60,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["MacBook Air 13-inch rental by arrangement"],
      "not-included": ["Tax"],
      bring: [],
    },
    facilitiesStatus: "Confirm equipment availability with Enigma",
    addons: [],
    imageAlt: "MacBook Air rental",
  },
  {
    id: "svc-enigma-courier",
    slug: "courier",
    brand: "enigma",
    name: "Courier — Kingston",
    useCase: "Courier trip within Kingston",
    description:
      "Enigma lists courier service in Kingston at JMD 1,500 per trip; contact Enigma to arrange it.",
    resourceIds: [],
    maxAttendees: 1,
    hourlyRateMinor: null,
    publishedPrices: [{ label: "Per trip", amountMinor: 150000 }],
    bookableHourly: false,
    minDurationMinutes: 60,
    maxDurationMinutes: 60,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Kingston courier trip by arrangement"],
      "not-included": ["Tax"],
      bring: [],
    },
    facilitiesStatus: "Confirm courier availability with Enigma",
    addons: [],
    imageAlt: "Enigma courier service",
  },
  {
    id: "svc-studio-rental",
    slug: "studio-rental",
    brand: "studio-d",
    name: "Studio rental",
    useCase: "Photo and video shoots on the open studio floor",
    description:
      "The full studio floor for your own production. Uses the same physical room as the podcast setup, so the two cannot overlap.",
    resourceIds: ["res-studio-main"],
    maxAttendees: 10,
    hourlyRateMinor: null,
    publishedPrices: [
      { label: "Hourly", amountMinor: 850000 },
      { label: "Daily (12 hours)", amountMinor: 9000000 },
    ],
    bookableHourly: false,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Exclusive use of the studio floor", "Power access", "Wi-Fi"],
      "not-included": ["Lighting kit", "Cameras", "Crew, engineer or videographer", "Editing"],
      bring: ["Your camera and lighting equipment", "Your crew", "Any backdrops or props"],
    },
    facilitiesStatus: "Studio dimensions and loading access pending confirmation",
    addons: [],
    imageAlt: "Studio D open studio floor with high ceilings",
  },
  {
    id: "svc-studio-lounge",
    slug: "studio-lounge",
    brand: "studio-d",
    name: "Studio Lounge (space only)",
    useCase: "Lounge rental for creative sessions",
    description: "Space-only lounge rental. The published daily rate is listed for reference.",
    resourceIds: ["res-studio-main"],
    maxAttendees: 10,
    hourlyRateMinor: null,
    publishedPrices: [
      { label: "Hourly", amountMinor: 500000 },
      { label: "Daily", amountMinor: 2500000 },
    ],
    bookableHourly: false,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Studio Lounge space only", "High-speed internet"],
      "not-included": ["Equipment unless arranged"],
      bring: ["Your production equipment"],
    },
    facilitiesStatus: "Equipment access by request; confirm availability",
    addons: [],
    imageAlt: "Studio D lounge",
  },
  {
    id: "svc-studio-recording-booth",
    slug: "recording-booth",
    brand: "studio-d",
    name: "Recording Booth (space only)",
    useCase: "Voiceover, music, and podcast recording",
    description:
      "Space-only recording booth rental. Published rates are listed for reference; equipment access is by request.",
    resourceIds: ["res-studio-main"],
    maxAttendees: 4,
    hourlyRateMinor: null,
    publishedPrices: [
      { label: "Hourly", amountMinor: 500000 },
      { label: "Daily", amountMinor: 2500000 },
    ],
    bookableHourly: false,
    minDurationMinutes: 60,
    maxDurationMinutes: 480,
    stepMinutes: 30,
    status: "published",
    content: {
      included: ["Soundproof recording booth", "High-speed internet"],
      "not-included": ["Equipment unless arranged"],
      bring: ["Confirm microphone and equipment needs"],
    },
    facilitiesStatus: "Equipment available upon request; confirm before booking",
    addons: [],
    imageAlt: "Studio D recording booth",
  },
  {
    id: "svc-studio-podcast",
    slug: "podcast-setup",
    brand: "studio-d",
    name: "Podcast setup",
    useCase: "Seated multi-person conversation recording",
    description:
      "A seated podcast configuration in the studio. Included equipment must be confirmed before this can be published.",
    resourceIds: ["res-studio-main"],
    maxAttendees: 4,
    hourlyRateMinor: null,
    publishedPrices: [],
    bookableHourly: false,
    minDurationMinutes: 60,
    maxDurationMinutes: 240,
    stepMinutes: 30,
    status: "draft",
    draftReason: "No approved rate and no confirmed equipment list",
    content: {
      included: ["Seated table configuration in the studio"],
      "not-included": ["Microphones and interfaces are not confirmed", "Engineer", "Editing"],
      bring: ["To be confirmed once the included equipment is approved"],
    },
    facilitiesStatus: "Equipment list pending approval",
    addons: [],
    imageAlt: "Podcast table configuration inside Studio D",
  },
];

export function servicesForBrand(brand: BrandSlug, includeDrafts = false): Service[] {
  return services.filter((s) => s.brand === brand && (includeDrafts || s.status === "published"));
}

export function getService(id: string): Service | undefined {
  return services.find((s) => s.id === id);
}

export function getServiceBySlug(brand: string, slug: string): Service | undefined {
  return services.find((s) => s.brand === brand && s.slug === slug);
}

export function resourceNames(service: Service): string {
  return service.resourceIds
    .map((id) => resources.find((r) => r.id === id)?.name ?? id)
    .join(" + ");
}

/** Proposed operating hours, local venue time. */
export const operatingHours = {
  weekdayOpen: "08:00",
  weekdayClose: "20:00",
  saturdayOpen: "09:00",
  saturdayClose: "17:00",
  sundayClosed: true,
};

export const bookingRules = {
  advanceNoticeHours: 4,
  horizonDays: 90,
  holdMinutes: 10,
  bufferMinutes: 0,
  payInPersonExpiry: "Earlier of 24 hours after submission or the session start time",
};

export type BookingState =
  | "held"
  | "pending_confirmation"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "no_show"
  | "cancelled"
  | "expired"
  | "payment_exception";

export type PaymentState = "unpaid" | "pending" | "paid" | "failed" | "refunded";

export interface DemoBooking {
  reference: string;
  serviceId: string;
  customerName: string;
  customerEmail: string;
  date: string; // yyyy-mm-dd, venue local
  start: string; // HH:mm venue local
  end: string;
  attendees: number;
  totalMinor: number;
  paidMinor: number;
  bookingState: BookingState;
  paymentState: PaymentState;
  paymentMode: "online" | "in-person";
  note?: string;
}

// Catalog proposals are never authoritative for live reservations.
for (const service of services) {
  if (!service.resourceIds.length) service.bookableHourly = false;
}

export const integrationStatus = [
  {
    name: "Online payment provider",
    status: "not-configured" as const,
    detail: "No provider selected",
  },
  {
    name: "Customer email",
    status: "not-configured" as const,
    detail: "Sender domain not supplied",
  },
  { name: "Staff Slack", status: "not-configured" as const, detail: "Channel IDs not confirmed" },
  {
    name: "Tax configuration",
    status: "not-configured" as const,
    detail: "No approved rate; not the same as zero",
  },
];
