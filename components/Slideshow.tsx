"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "./I18n";

interface Photo { name: string }

/** Full-screen crossfading slideshow. Re-reads the photo list every 30 seconds so new pictures appear. */
export default function Slideshow({ seconds, initial }: { seconds: number; initial: Photo[] }) {
  const t = useT();
  const [photos, setPhotos] = useState(initial);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/photos", { cache: "no-store" });
        if (res.ok) setPhotos(await res.json());
      } catch {}
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => i + 1), seconds * 1000);
    return () => window.clearInterval(id);
  }, [photos.length, seconds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (photos.length === 0) return <p className="opacity-70 pt-6 text-center">{t("noPhotos")}</p>;
  const current = index % photos.length;

  return (
    <div className="fixed inset-0 z-10 bg-black">
      {photos.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.name}
          src={`/api/photos/${p.name}`}
          alt=""
          aria-hidden={i !== current}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-1000 ${i === current ? "opacity-100" : "opacity-0"}`}
          loading={Math.abs(i - current) < 3 ? "eager" : "lazy"}
        />
      ))}
      <Link href="/" className="absolute top-3 left-3 z-20 px-3 py-1 rounded-none bg-black/50 text-sm opacity-60 hover:opacity-100">
        ←
      </Link>
      <p className="absolute bottom-3 right-4 z-20 text-xs opacity-40">F: fullscreen</p>
    </div>
  );
}
