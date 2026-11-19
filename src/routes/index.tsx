import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { SiteLayout } from "@/components/site-chrome";
import { VenueImage } from "@/components/venue-image";
import { useCatalog } from "@/hooks/use-catalog";
import { brandPhotos, servicePhoto } from "@/data/venue-media";
import { matchingSpaces, type Purpose } from "@/lib/space-discovery";
import { venueDate } from "@/lib/booking";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Creative Collective — Where ideas come to life" },
      {
        name: "description",
        content: "Explore workspace and production spaces at Enigma and Studio D.",
      },
    ],
  }),
  component: Home,
});

const categories: { value: Purpose | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "studio", label: "Studios" },
  { value: "recording", label: "Recording" },
  { value: "meeting", label: "Meeting" },
  { value: "workspace", label: "Desks & offices" },
  { value: "lounge", label: "Lounges & pods" },
];

function Home() {
  const catalog = useCatalog();
  const navigate = useNavigate();
  const [venue, setVenue] = useState<"" | "enigma" | "studio-d">("");
  const [date, setDate] = useState("");
  const [filterVenue, setFilterVenue] = useState<"" | "enigma" | "studio-d">("");
  const [purpose, setPurpose] = useState<Purpose | "">("");
  const matches = matchingSpaces(catalog.data?.services ?? [], { venue: filterVenue, purpose });
  return (
    <SiteLayout home>
      <div className="psd-home">
        <section className="psd-hero">
          <div className="psd-wrap psd-hero-inner">
            <div className="psd-hero-copy">
              <p className="psd-kicker">
                <span /> Workspace · Production · Community
              </p>
              <h1>
                Where ideas
                <br />
                <span>come to life.</span>
              </h1>
              <p className="psd-lead">
                Creative Collective brings Enigma and Studio D together: a place to plan, make, and
                share your next big idea.
              </p>
              <form
                className="psd-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  void navigate({
                    to: "/spaces",
                    search: { venue: venue || undefined, date: date || undefined },
                  });
                }}
              >
                <label>
                  Where
                  <select
                    value={venue}
                    onChange={(event) => setVenue(event.target.value as typeof venue)}
                  >
                    <option value="">Studio D or Enigma</option>
                    <option value="studio-d">Studio D</option>
                    <option value="enigma">Enigma</option>
                  </select>
                </label>
                <label>
                  When
                  <span className="psd-date-field">
                    {!date && (
                      <span className="psd-date-placeholder" aria-hidden="true">
                        Choose a date
                      </span>
                    )}
                    <input
                      aria-label="Choose a date"
                      type="date"
                      min={venueDate()}
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </span>
                </label>
                <div className="psd-search-time">
                  <strong>Time</strong>
                  <span>Jamaica time</span>
                </div>
                <button type="submit">
                  Find and compare spaces <Search size={17} />
                </button>
              </form>
              <p className="psd-time">Book your space in Jamaica time (America/Jamaica)</p>
            </div>
            <div className="psd-hero-art">
              <img src="/images/home/hero-art-no-text.png" alt="" aria-hidden="true" />
              <div className="psd-art-label psd-art-label-enigma">
                <strong>enigma</strong>
                <span>Space to focus and connect</span>
              </div>
              <div className="psd-art-label psd-art-label-studio">
                <span>Space to create and produce</span>
                <strong>STUDIO D</strong>
              </div>
            </div>
          </div>
        </section>
        <div className="psd-content">
          <section className="psd-wrap psd-explore">
            <h2>Explore our spaces</h2>
            <div className="psd-venue-grid">
              <article className="psd-venue psd-studio">
                <p className="psd-studio-wordmark">
                  <img src="/images/home/studio-d-logo.png" alt="Studio D" />
                </p>
                <p>
                  A studio that can be booked as an open studio rental or as a podcast
                  configuration.
                </p>
                <Link
                  to="/$brand"
                  params={{ brand: "studio-d" }}
                  className="psd-pill psd-pill-light"
                >
                  See Studio D spaces <ArrowRight size={17} />
                </Link>
                <div className="psd-venue-image">
                  <VenueImage
                    photo={brandPhotos["studio-d"].cover}
                    alt="Studio D"
                    className="psd-venue-photo"
                  />
                </div>
              </article>
              <article className="psd-venue psd-enigma">
                <p className="psd-enigma-wordmark">
                  <img src="/images/home/enigma-symbol.png" alt="" aria-hidden="true" />
                  <span>enigma</span>
                </p>
                <p>Desks, a meeting room and offices for focused work and short sessions.</p>
                <Link to="/$brand" params={{ brand: "enigma" }} className="psd-pill">
                  See Enigma spaces <ArrowRight size={17} />
                </Link>
                <div className="psd-venue-image">
                  <VenueImage
                    photo={brandPhotos.enigma.cover}
                    alt="Enigma"
                    className="psd-venue-photo"
                  />
                </div>
              </article>
            </div>
          </section>
          <section className="psd-wrap psd-find" id="find-your-space">
            <p className="psd-eyebrow">Find your space</p>
            <h2>Make room for what’s next.</h2>
            <p className="psd-find-description">
              Choose a destination to explore spaces and book a time.
            </p>
            <div className="psd-filters" aria-label="Filter spaces">
              <div className="psd-venue-filters" aria-label="Venue">
                {(
                  [
                    { value: "", label: "All Spaces" },
                    { value: "studio-d", label: "Studio D" },
                    { value: "enigma", label: "Enigma" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={filterVenue === item.value}
                    onClick={() => setFilterVenue(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="psd-category-filters" aria-label="Space type">
                {categories.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={purpose === item.value}
                    onClick={() => setPurpose(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            {catalog.isLoading ? (
              <div role="status">
                <span className="sr-only">Loading spaces…</span>
                <div className="psd-space-grid psd-space-skeletons" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div className="psd-space-skeleton" key={index}>
                      <div className="psd-space-image" />
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              </div>
            ) : catalog.error ? (
              <p role="alert">
                Couldn’t load spaces.{" "}
                <button onClick={() => void catalog.refetch()}>Try again</button>
              </p>
            ) : matches.length ? (
              <>
                <div className="psd-space-grid">
                  {matches.slice(0, 6).map((service) => (
                    <article className="psd-space" key={service.id}>
                      <div className="psd-space-image">
                        <VenueImage
                          photo={servicePhoto(service)}
                          alt={service.name}
                          className="psd-space-photo"
                        />
                        <span>{service.brand === "enigma" ? "Enigma" : "Studio D"}</span>
                      </div>
                      <h3>{service.id === "svc-enigma-meeting" ? "Meeting Room" : service.name}</h3>
                      <p>
                        {service.id === "svc-enigma-meeting"
                          ? "Team meetings, interviews and client sessions"
                          : service.description}
                      </p>
                      <Link
                        to="/$brand/services/$slug"
                        params={{ brand: service.brand, slug: service.slug }}
                      >
                        Request to book &gt;
                      </Link>
                    </article>
                  ))}
                </div>
                {matches.length > 6 && (
                  <Link
                    className="psd-view-all"
                    to="/spaces"
                    search={{ venue: filterVenue || undefined, purpose: purpose || undefined }}
                  >
                    View all {matches.length} spaces <ArrowRight size={18} />
                  </Link>
                )}
              </>
            ) : (
              <p role="status">No spaces match these filters.</p>
            )}
          </section>
          <section className="psd-wrap psd-how" id="how-it-works">
            <p className="psd-eyebrow">How booking works</p>
            <h2>Request, approval, pay.</h2>
            <div className="psd-steps">
              {[
                [
                  "Request a time",
                  "Pick a space and a slot. Times are shown in Jamaica time (America/Jamaica).",
                ],
                ["Staff approve", "Reservations require staff approval before they are confirmed."],
                [
                  "Pay for booking",
                  "Pay at the space after approval. Prices are in JMD, and applicable tax appears in your booking summary.",
                ],
              ].map(([title, description], i) => (
                <article key={title}>
                  <span>{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="psd-wrap psd-quote-wrap">
            <div className="psd-quote">
              <div>
                <h2>Planning something longer?</h2>
                <p>Longer rentals are arranged by quote.</p>
              </div>
              <img src="/images/home/quote-person.png" alt="" />
              <Link
                to="/$brand/services/$slug"
                params={{ brand: "studio-d", slug: "studio-rental" }}
                hash="enquiry"
                className="psd-pill psd-pill-light"
              >
                Ask for a quote <ArrowRight />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </SiteLayout>
  );
}
