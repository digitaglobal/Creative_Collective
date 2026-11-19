import { useEffect, useRef, useState } from "react";
import { ImagePlaceholder } from "@/components/demo-banner";
import type { VenuePhoto } from "@/data/venue-media";

export function VenueImage({
  photo,
  alt,
  className = "",
  eager = false,
  showLoading = false,
}: {
  photo: VenuePhoto | undefined;
  alt: string;
  className?: string;
  eager?: boolean;
  showLoading?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const photoSrc = photo?.src;
  useEffect(() => {
    const image = imageRef.current;
    if (showLoading && photoSrc && image?.complete && image.currentSrc) {
      if (image.naturalWidth > 0) setLoadedSrc(photoSrc);
      else setFailedSrc(photoSrc);
    }
  }, [photoSrc, showLoading]);
  if (!photo || failedSrc === photo.src)
    return <ImagePlaceholder alt={alt} className={className} />;
  const image = (
    <img
      ref={imageRef}
      src={photo.src}
      alt={photo.alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onLoad={showLoading ? () => setLoadedSrc(photo.src) : undefined}
      onError={() => setFailedSrc(photo.src)}
      className={`w-full object-cover ${className}`}
    />
  );
  if (!showLoading) return image;
  return (
    <div
      className={`space-image-frame ${loadedSrc !== photo.src ? "space-skeleton" : ""}`}
      aria-busy={loadedSrc !== photo.src}
    >
      {image}
    </div>
  );
}
