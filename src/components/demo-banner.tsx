import { TriangleAlert } from "lucide-react";
import { DEMO_MODE } from "@/data/catalog";

export function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <div className="bg-demo text-demo-foreground">
      <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 text-sm sm:items-center">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 sm:mt-0" />
        <p>
          <span className="font-semibold">Demo data</span> — not live availability, pricing or
          policy. This preview cannot create live reservations.
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
      <div
        aria-hidden="true"
        className="absolute -right-10 -top-16 size-56 rounded-full border-[32px] border-background/15"
      />
      <p className="relative m-3 rounded-sm bg-background/85 px-2 py-1 text-xs text-muted-foreground">
        Venue photo pending
      </p>
    </div>
  );
}
