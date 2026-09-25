import { TriangleAlert } from "lucide-react";
import { DEMO_MODE } from "@/data/demo";

export function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <div className="bg-demo text-demo-foreground">
      <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-sm sm:items-center">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 sm:mt-0" />
        <p>
          <span className="font-semibold">Demo data</span> — not live availability, pricing or
          policy. Bookings and payments are not yet functional.
        </p>
      </div>
    </div>
  );
}

export function ImagePlaceholder({ alt, className = "" }: { alt: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`Placeholder for: ${alt}. Venue photography pending.`}
      className={`relative flex items-end overflow-hidden rounded-xl bg-accent ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--color-card),transparent_60%)] opacity-70" />
      <p className="relative m-3 rounded-md bg-card/80 px-2 py-1 text-xs text-muted-foreground">
        Venue photo pending
      </p>
    </div>
  );
}
