"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicConfig } from "@/lib/config";
import { printPhoto } from "@/lib/print";

export function downloadUrl(name: string, cfg: Pick<PublicConfig, "publicUrl">, video = false) {
  const base = (cfg.publicUrl || window.location.origin).replace(/\/+$/, "");
  return `${base}/api/${video ? "videos" : "photos"}/${name}?download=1`;
}

export function makeQr(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 480, errorCorrectionLevel: "M" });
}

/** QR code (data URL) for a photo's download link, or null while it is being made. */
export function useQr(name: string | null, cfg: Pick<PublicConfig, "publicUrl">, enabled = true, video = false) {
  const [qr, setQr] = useState<{ name: string; url: string } | null>(null);
  useEffect(() => {
    if (!name || !enabled) return;
    let alive = true;
    makeQr(downloadUrl(name, cfg, video)).then((url) => alive && setQr({ name, url }), () => {});
    return () => {
      alive = false;
    };
  }, [name, enabled, cfg, video]);
  return qr && qr.name === name ? qr.url : null;
}

/** Print helper with the "Started printing!" message timer. */
export function usePrint(cfg: Pick<PublicConfig, "printPaper" | "printMsgSeconds">) {
  const [printing, setPrinting] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const print = useCallback(
    (name: string, size: { width: number; height: number }) => {
      printPhoto(`/api/photos/${name}`, cfg.printPaper, size);
      setPrinting(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setPrinting(false), cfg.printMsgSeconds * 1000);
    },
    [cfg.printPaper, cfg.printMsgSeconds],
  );
  return { printing, print };
}
