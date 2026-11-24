"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type PhotoSwipeLightboxType from "photoswipe/lightbox";
import type { PublicConfig } from "@/lib/config";
import { useT } from "./I18n";
import { usePrint } from "./hooks";
import PhotoActions from "./PhotoActions";

interface Photo { name: string; width: number; height: number; video?: string }

export default function GalleryClient({
  cfg,
  initial,
  admin,
}: {
  cfg: PublicConfig;
  initial: Photo[];
  admin: boolean;
}) {
  const t = useT();
  const [photos, setPhotos] = useState(initial);
  const [share, setShare] = useState<Photo | null>(null);
  const [playing, setPlaying] = useState<Photo | null>(null);
  const lightboxRef = useRef<PhotoSwipeLightboxType | null>(null);
  const photosRef = useRef(photos);
  const { printing, print } = usePrint(cfg);
  const canPrint = cfg.printMode === "both" || cfg.printMode === "gallery";

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const remove = useCallback(async (p: Photo) => {
    if (!window.confirm(`${t("delete")} ${p.name}?`)) return;
    const res = await fetch(`/api/photos/${p.name}`, { method: "DELETE" });
    if (res.ok) {
      lightboxRef.current?.pswp?.close();
      setPhotos((list) => list.filter((x) => x.name !== p.name));
    }
  }, [t]);

  // PhotoSwipe v5 lightbox, rebuilt when the set of photos changes.
  useEffect(() => {
    let lb: PhotoSwipeLightboxType | null = null;
    let cancelled = false;
    (async () => {
      const { default: PhotoSwipeLightbox } = await import("photoswipe/lightbox");
      if (cancelled) return;
      lb = new PhotoSwipeLightbox({
        dataSource: photos.map((p) => ({
          src: `/api/photos/${p.name}`,
          msrc: `/api/photos/${p.name}?thumb=1`,
          width: p.width,
          height: p.height,
          alt: p.name,
        })),
        pswpModule: () => import("photoswipe"),
        bgOpacity: 0.95,
      });
      const current = () => photosRef.current[lb!.pswp!.currIndex];

      lb.on("uiRegister", () => {
        const ui = lb!.pswp!.ui!;
        ui.registerElement({
          name: "download-link",
          order: 8,
          isButton: true,
          tagName: "a",
          title: t("download"),
          html: "⬇",
          onInit: (el, pswp) => {
            el.setAttribute("download", "");
            pswp.on("change", () => {
              (el as HTMLAnchorElement).href = `/api/photos/${current().name}?download=1`;
            });
          },
        });
        ui.registerElement({
          name: "play-video",
          order: 7,
          isButton: true,
          title: t("modeVideo"),
          html: "▶",
          onInit: (el, pswp) => {
            const update = () => {
              el.style.display = current()?.video ? "" : "none";
            };
            update();
            pswp.on("change", update);
          },
          onClick: () => setPlaying(current()),
        });
        ui.registerElement({
          name: "share",
          order: 9,
          isButton: true,
          title: `${t("email")} / QR`,
          html: "QR",
          onClick: () => {
            setShare(current());
          },
        });
        if (canPrint) {
          ui.registerElement({
            name: "print",
            order: 10,
            isButton: true,
            title: t("print"),
            html: "🖨",
            onClick: () => {
              const p = current();
              print(p.name, p);
            },
          });
        }
        if (admin) {
          ui.registerElement({
            name: "delete",
            order: 11,
            isButton: true,
            title: t("delete"),
            html: "🗑",
            onClick: () => remove(current()),
          });
        }
      });
      lb.init();
      lightboxRef.current = lb;
    })();
    return () => {
      cancelled = true;
      lb?.destroy();
      lightboxRef.current = null;
    };
  }, [photos, admin, canPrint, print, remove, t]);

  if (photos.length === 0) return <p className="opacity-70 pt-6">{t("noPhotos")}</p>;

  return (
    <>
      {printing && (
        <div role="status" className="fixed inset-0 z-[300000] grid place-items-center bg-black/70 text-3xl text-center p-6">
          {t("printing")}
        </div>
      )}
      <ul
        style={{ "--cols": cfg.galleryColumns } as React.CSSProperties}
        className="grid grid-cols-2 gap-3 sm:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
      >
        {photos.map((p, i) => (
          <li key={p.name}>
            <button
              type="button"
              onClick={() => lightboxRef.current?.loadAndOpen(i)}
              className="relative block w-full rounded overflow-hidden border border-white/10 hover:border-[var(--accent)]"
              aria-label={p.name}
            >
              {p.video && (
                <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-none bg-black/60 text-xs">▶</span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${p.name}?thumb=1`}
                alt={p.name}
                loading="lazy"
                width={p.width}
                height={p.height}
                className="w-full h-auto"
              />
            </button>
          </li>
        ))}
      </ul>

      {playing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[400000] grid place-items-center bg-black/90 p-4"
          onClick={(e) => e.target === e.currentTarget && setPlaying(null)}
        >
          <div className="flex flex-col items-center gap-3">
            <video
              src={`/api/videos/${playing.name}`}
              autoPlay
              loop
              controls
              playsInline
              className="max-h-[80vh] max-w-full rounded"
            />
            <button type="button" className="px-5 py-2 rounded-none border border-white/40" onClick={() => setPlaying(null)}>
              {t("close")}
            </button>
          </div>
        </div>
      )}

      {share && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200000] grid place-items-center bg-black/80 p-4"
          onClick={(e) => e.target === e.currentTarget && setShare(null)}
        >
          <div className="bg-[#14171b] rounded-none p-6 flex flex-col items-center gap-4 max-h-[90vh] overflow-auto">
            <PhotoActions
              name={share.name}
              cfg={cfg}
              context="gallery"
              showQr={cfg.galleryShowQr}
              onPrint={() => print(share.name, share)}
              video={!!share.video}
            />
            <button type="button" className="px-5 py-2 rounded-none border border-white/40" onClick={() => setShare(null)}>
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
