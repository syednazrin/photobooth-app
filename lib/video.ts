// Video strips: each shot is a short clip. The clips are played side by side into the same strip layout
// (colour, borders, footer, QR) and the result is recorded with MediaRecorder.

import { drawKeyed, type ChromaOpts } from "./chroma";
import { createComposer, type LookChoice } from "./compose";
import { FILTER_CSS, type PublicConfig } from "./config";

export const videoSupported = () =>
  typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;

const pick = (prefs: string[]) => prefs.find((m) => MediaRecorder.isTypeSupported(m));

/** Record `ms` milliseconds of a live camera stream. */
export function recordClip(stream: MediaStream, ms: number): Promise<Blob> {
  const mimeType = pick(["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm", "video/mp4"]);
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  return new Promise((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType }));
    rec.onerror = () => reject(new Error("Recording failed"));
    rec.start(250);
    window.setTimeout(() => rec.state !== "inactive" && rec.stop(), ms);
  });
}

function loadClip(blob: Blob): Promise<{ v: HTMLVideoElement; url: string }> {
  const url = URL.createObjectURL(blob);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  return new Promise((resolve, reject) => {
    v.onloadeddata = () => resolve({ v, url });
    v.onerror = () => reject(new Error("A clip could not be read"));
    v.src = url;
  });
}

export interface RenderVideoInput {
  cfg: PublicConfig;
  clips: Blob[];
  filter: string;
  look: LookChoice;
  qrDataUrl: string | null;
  frameImg: HTMLImageElement | null;
  chroma: ChromaOpts | null;
  seconds: number;
}

/** Plays all clips into the strip layout and records it. Returns the video and a still frame for the gallery. */
export async function renderVideo(o: RenderVideoInput): Promise<{ blob: Blob; poster: HTMLCanvasElement }> {
  const composer = await createComposer(
    { cfg: o.cfg, qrDataUrl: o.qrDataUrl, frameImg: o.frameImg, look: o.look },
    720,
    1920,
  );
  const loaded = await Promise.all(o.clips.map(loadClip));
  const vids = loaded.map((l) => l.v);
  const css = FILTER_CSS[o.filter] ?? "none";
  const tmp = vids.map(() => document.createElement("canvas"));
  const tmp2 = vids.map(() => document.createElement("canvas"));

  const frameOf = (i: number): HTMLCanvasElement => {
    const v = vids[i];
    const width = o.chroma ? 480 : 720;
    const w = width;
    const h = Math.max(2, Math.round((width * (v.videoHeight || 9)) / (v.videoWidth || 16)));
    const a = tmp[i];
    if (a.width !== w || a.height !== h) {
      a.width = w;
      a.height = h;
    }
    const ctx = a.getContext("2d")!;
    if (o.chroma) {
      drawKeyed(a, v, w, h, o.cfg.mirror, o.chroma);
    } else {
      ctx.save();
      if (o.cfg.mirror) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.filter = css === "none" ? "none" : css;
      ctx.drawImage(v, 0, 0, w, h);
      ctx.restore();
    }
    if (o.chroma && css !== "none") {
      const b = tmp2[i];
      b.width = w;
      b.height = h;
      const bctx = b.getContext("2d")!;
      bctx.filter = css;
      bctx.drawImage(a, 0, 0);
      return b;
    }
    return a;
  };

  const drawAll = () => composer.draw(vids.map((_, i) => frameOf(i)));
  drawAll();

  const mimeType = pick([
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ]);
  const rec = new MediaRecorder(composer.canvas.captureStream(30), { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType }));
  });

  let poster: HTMLCanvasElement | null = null;
  const snap = () => {
    const c = document.createElement("canvas");
    c.width = composer.canvas.width;
    c.height = composer.canvas.height;
    c.getContext("2d")!.drawImage(composer.canvas, 0, 0);
    return c;
  };

  try {
    rec.start(250);
    await Promise.all(vids.map((v) => v.play()));
    const t0 = performance.now();
    const limit = o.seconds * 1000 + 300;
    await new Promise<void>((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - t0;
        drawAll();
        if (!poster && elapsed > o.seconds * 400) poster = snap();
        if (elapsed >= limit || vids.every((v) => v.ended)) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    if (!poster) poster = snap();
    if (rec.state !== "inactive") rec.stop();
    const blob = await stopped;
    return { blob, poster };
  } finally {
    if (rec.state !== "inactive") rec.stop();
    vids.forEach((v) => v.pause());
    loaded.forEach((l) => URL.revokeObjectURL(l.url));
  }
}
