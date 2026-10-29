import { useState } from "react";
import { ImagePlaceholder } from "@/components/demo-banner";
import type { VenuePhoto } from "@/data/venue-media";

export function VenueImage({
  photo,
  alt,
  className = "",
  eager = false,
}: {
  photo: VenuePhoto | undefined;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!photo || failedSrc === photo.src)
    return <ImagePlaceholder alt={alt} className={className} />;
  return (
    <img
      src={photo.src}
      alt={photo.alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailedSrc(photo.src)}
      className={`w-full object-cover ${className}`}
    />
  );
}
