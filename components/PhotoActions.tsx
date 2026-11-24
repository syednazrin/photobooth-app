"use client";

import { useState } from "react";
import type { PublicConfig } from "@/lib/config";
import { useT } from "./I18n";
import { useQr } from "./hooks";

const btn = "px-5 py-2 rounded-none border border-white/40 hover:border-[var(--accent)] disabled:opacity-40";

export default function PhotoActions({
  name,
  cfg,
  context,
  showQr,
  onPrint,
  video = false,
}: {
  name: string;
  cfg: PublicConfig;
  context: "booth" | "gallery";
  showQr: boolean;
  onPrint: () => void;
  video?: boolean;
}) {
  const t = useT();
  const qr = useQr(name, cfg, showQr, video);
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err" | "busy"; text: string } | null>(null);

  const canPrint = cfg.printMode === "both" || cfg.printMode === context;

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "busy", text: t("sending") });
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, name }),
      });
      const data = await res.json().catch(() => ({}));
      setStatus(res.ok ? { kind: "ok", text: t("emailSent") } : { kind: "err", text: data.error || "Error" });
      if (res.ok) setTo("");
    } catch {
      setStatus({ kind: "err", text: "Network error" });
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex flex-wrap justify-center gap-2">
        {video && (
          <a href={`/api/videos/${name}?download=1`} className={btn}>
            {t("downloadVideo")}
          </a>
        )}
        <a href={`/api/photos/${name}?download=1`} className={btn}>
          {t("download")}
        </a>
        {canPrint && (
          <button type="button" onClick={onPrint} className={btn}>
            {t("print")}
          </button>
        )}
      </div>

      {cfg.emailEnabled && (
        <form onSubmit={sendEmail} className="flex flex-wrap justify-center gap-2">
          <input
            type="email"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder={t("emailPlaceholder")}
            aria-label={t("email")}
            className="px-4 py-2 rounded-none bg-white/10 border border-white/30 min-w-60"
          />
          <button type="submit" disabled={status?.kind === "busy"} className={btn}>
            {t("send")}
          </button>
        </form>
      )}
      {status && (
        <p role="status" className={status.kind === "err" ? "text-red-300" : "opacity-80"}>
          {status.text}
        </p>
      )}

      {showQr && qr && (
        <figure className="flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code" width={180} height={180} className="rounded bg-white p-2" />
          <figcaption className="text-sm opacity-70">{t("scanQr")}</figcaption>
        </figure>
      )}
    </div>
  );
}
