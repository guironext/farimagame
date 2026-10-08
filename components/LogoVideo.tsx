"use client";

import { useEffect, useRef } from "react";

export function LogoVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // React ne pose pas toujours la propriété DOM `muted`, ce qui bloque l'autoplay.
    v.muted = true;
    v.defaultMuted = true;
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
    v.addEventListener("canplay", tryPlay, { once: true });
    return () => v.removeEventListener("canplay", tryPlay);
  }, []);

  return (
    <video
      ref={ref}
      aria-label="FarimaGame"
      width={1280}
      height={720}
      className={className}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      poster="/logo.png"
    >
      <source src="/logoAnime.mp4" type="video/mp4" />
    </video>
  );
}
