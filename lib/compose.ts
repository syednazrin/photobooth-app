import { FILTER_CSS, fillTemplate, type BorderStyle, type LayoutId, type PublicConfig } from "./config";
import { animeFilter } from "./anime";

const ASPECTS: Record<PublicConfig["photoAspect"], number> = { "3:2": 3 / 2, "4:3": 4 / 3, "16:9": 16 / 9, "1:1": 1 };
export const aspectRatio = (cfg: Pick<PublicConfig, "photoAspect">) => ASPECTS[cfg.photoAspect];

function newCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Centre-crop a canvas to an aspect ratio (w/h), capping the width. */
export function cropToAspect(src: HTMLCanvasElement, ar: number, maxW = 1600): HTMLCanvasElement {
  let sw = src.width;
  let sh = src.width / ar;
  if (sh > src.height) {
    sh = src.height;
    sw = sh * ar;
  }
  const ow = Math.min(sw, maxW);
  const out = newCanvas(ow, ow / ar);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, out.width, out.height);
  return out;
}

/** Film grain: random brightness noise added to every pixel. */
function addGrain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() + Math.random() + Math.random() - 1.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function addVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(20,8,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function cssFilter(src: HTMLCanvasElement, id: string): HTMLCanvasElement {
  const css = FILTER_CSS[id];
  if (!css || css === "none") return src;
  const out = newCanvas(src.width, src.height);
  const ctx = out.getContext("2d")!;
  ctx.filter = css; // not supported by Safari; the picture is then left unfiltered
  ctx.drawImage(src, 0, 0);
  ctx.filter = "none";
  if (id === "vintage") {
    // faded warm film: lifted blacks, light leak at the corner, soft grain, dark edges
    ctx.fillStyle = "rgba(255,170,90,0.10)";
    ctx.fillRect(0, 0, out.width, out.height);
    addVignette(ctx, out.width, out.height, 0.55);
    addGrain(ctx, out.width, out.height, 38);
  } else if (id === "grainy") {
    addGrain(ctx, out.width, out.height, 90);
  }
  return out;
}

/** Apply a filter to every shot. Anime results are cached per shot set. */
export async function filterShots(
  shots: HTMLCanvasElement[],
  filter: string,
  cache: Map<string, HTMLCanvasElement[]>,
): Promise<HTMLCanvasElement[]> {
  if (filter === "anime") {
    const hit = cache.get("anime");
    if (hit) return hit;
    const out: HTMLCanvasElement[] = [];
    for (const s of shots) out.push(await animeFilter(s));
    cache.set("anime", out);
    return out;
  }
  return shots.map((s) => cssFilter(s, filter));
}

function polaroidCard(photo: HTMLCanvasElement, caption: string): HTMLCanvasElement {
  const side = photo.width * 0.055;
  const bottom = photo.width * 0.2;
  const card = newCanvas(photo.width + side * 2, photo.height + side + bottom);
  const ctx = card.getContext("2d")!;
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(0, 0, card.width, card.height);
  ctx.drawImage(photo, side, side);
  // faint inner edge, like the film window of a real Polaroid
  ctx.strokeStyle = "rgba(0,0,0,.12)";
  ctx.lineWidth = Math.max(1, photo.width * 0.002);
  ctx.strokeRect(side, side, photo.width, photo.height);
  if (caption) {
    ctx.fillStyle = "#3b3a36";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(photo.width * 0.06)}px "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive`;
    ctx.fillText(caption, card.width / 2, photo.height + side + bottom / 2, card.width - side * 2);
  }
  return card;
}

interface Cell { x: number; y: number; w: number; h: number }

const M = 64;
const G = 48;

function layoutCells(layout: LayoutId, ar: number): { W: number; H: number; cells: Cell[] } {
  const cell = (x: number, y: number, w: number): Cell => ({ x, y, w, h: w / ar });
  switch (layout) {
    case "single": {
      const W = 1800, cw = W - 2 * M;
      return { W, H: cw / ar + 2 * M, cells: [cell(M, M, cw)] };
    }
    case "strip": {
      const W = 1000, cw = W - 2 * M, ch = cw / ar;
      return { W, H: 4 * ch + 3 * G + 2 * M, cells: [0, 1, 2, 3].map((i) => cell(M, M + i * (ch + G), cw)) };
    }
    case "grid": {
      const W = 1800, cw = (W - 2 * M - G) / 2, ch = cw / ar;
      return {
        W,
        H: 2 * ch + G + 2 * M,
        cells: [0, 1, 2, 3].map((i) => cell(M + (i % 2) * (cw + G), M + Math.floor(i / 2) * (ch + G), cw)),
      };
    }
    case "grid2x3": {
      const W = 1800, cw = (W - 2 * M - G) / 2, ch = cw / ar;
      return {
        W,
        H: 3 * ch + 2 * G + 2 * M,
        cells: [0, 1, 2, 3, 4, 5].map((i) => cell(M + (i % 2) * (cw + G), M + Math.floor(i / 2) * (ch + G), cw)),
      };
    }
    case "grid6": {
      const W = 2400, cw = (W - 2 * M - 2 * G) / 3, ch = cw / ar;
      return {
        W,
        H: 2 * ch + G + 2 * M,
        cells: [0, 1, 2, 3, 4, 5].map((i) => cell(M + (i % 3) * (cw + G), M + Math.floor(i / 3) * (ch + G), cw)),
      };
    }
    case "row3": {
      const W = 2400, cw = (W - 2 * M - 2 * G) / 3;
      return { W, H: cw / ar + 2 * M, cells: [0, 1, 2].map((i) => cell(M + i * (cw + G), M, cw)) };
    }
    case "feature": {
      const W = 1800, bw = W - 2 * M, bh = bw / ar, sw = (W - 2 * M - G) / 2, sh = sw / ar;
      return {
        W,
        H: bh + G + sh + 2 * M,
        cells: [cell(M, M, bw), cell(M, M + bh + G, sw), cell(M + sw + G, M + bh + G, sw)],
      };
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}

export interface LookChoice {
  stamp?: boolean;
  bg: string;
  border: BorderStyle;
  borderColor: string;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Keep the configured text colour when it is readable on the background, otherwise pick black or white. */
function readableOn(bg: string, preferred: string) {
  if (contrast(bg, preferred) >= 3) return preferred;
  return contrast(bg, "#ffffff") >= contrast(bg, "#111111") ? "#ffffff" : "#111111";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Orange camera-style date and time in the bottom-right corner of a photo. */
function stampPhoto(photo: HTMLCanvasElement, date: Date): HTMLCanvasElement {
  const out = newCanvas(photo.width, photo.height);
  const ctx = out.getContext("2d")!;
  ctx.drawImage(photo, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  const text = `${date.getFullYear()}.${p(date.getMonth() + 1)}.${p(date.getDate())}  ${p(date.getHours())}:${p(date.getMinutes())}`;
  const size = Math.round(out.width * 0.045);
  ctx.font = `700 ${size}px "Courier New", ui-monospace, monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(255,90,0,.7)";
  ctx.shadowBlur = size * 0.35;
  ctx.fillStyle = "#ffa23a";
  ctx.fillText(text, out.width - size * 0.7, out.height - size * 0.55);
  return out;
}

/** Draw one photo with its border style. The border grows outward from the cell. */
function drawFramedPhoto(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, c: Cell, style: BorderStyle, color: string) {
  const u = c.w / 1000; // scale with the photo size
  const draw = (x: number, y: number, w: number, h: number, r = 0) => {
    ctx.save();
    if (r) {
      roundRect(ctx, x, y, w, h, r);
      ctx.clip();
    }
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  };
  switch (style) {
    case "none":
      draw(c.x, c.y, c.w, c.h);
      break;
    case "thin": {
      const b = Math.max(6, u * 14);
      ctx.fillStyle = color;
      ctx.fillRect(c.x - b, c.y - b, c.w + 2 * b, c.h + 2 * b);
      draw(c.x, c.y, c.w, c.h);
      break;
    }
    case "thick": {
      const b = Math.max(10, u * 30);
      ctx.fillStyle = color;
      ctx.fillRect(c.x - b, c.y - b, c.w + 2 * b, c.h + 2 * b);
      draw(c.x, c.y, c.w, c.h);
      break;
    }
    case "rounded": {
      const b = Math.max(8, u * 22);
      const r = u * 70;
      ctx.fillStyle = color;
      roundRect(ctx, c.x - b, c.y - b, c.w + 2 * b, c.h + 2 * b, r + b);
      ctx.fill();
      draw(c.x, c.y, c.w, c.h, r);
      break;
    }
    case "double": {
      const b = Math.max(10, u * 34);
      ctx.fillStyle = color;
      ctx.fillRect(c.x - b, c.y - b, c.w + 2 * b, c.h + 2 * b);
      draw(c.x, c.y, c.w, c.h);
      // thin line inset in the border, in the photo's own shadow colour
      ctx.strokeStyle = "rgba(0,0,0,.28)";
      ctx.lineWidth = Math.max(1.5, u * 3);
      ctx.strokeRect(c.x - b * 0.5, c.y - b * 0.5, c.w + b, c.h + b);
      break;
    }
    case "float": {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.45)";
      ctx.shadowBlur = u * 40;
      ctx.shadowOffsetY = u * 14;
      ctx.fillStyle = color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.restore();
      draw(c.x, c.y, c.w, c.h);
      break;
    }
  }
}

export interface ComposeInput {
  cfg: PublicConfig;
  shots: HTMLCanvasElement[]; // already filtered
  qrDataUrl?: string | null;
  frameImg?: HTMLImageElement | null;
  look?: LookChoice;
  date?: Date;
}

export interface Composer {
  canvas: HTMLCanvasElement;
  /** Draw the shots (one per cell) into `canvas` and return it. Can be called again for every video frame. */
  draw: (shots: HTMLCanvasElement[]) => HTMLCanvasElement;
}

/** Builds the strip/collage once (layout, QR, sizes) so it can be redrawn cheaply, e.g. for each video frame. */
export async function createComposer(
  { cfg, qrDataUrl, frameImg, look, date = new Date() }: Omit<ComposeInput, "shots">,
  maxShotWidth = 1600,
  maxDim = 0, // when set, the output canvas is scaled down so its longer side is at most this (used for video)
): Promise<Composer> {
  const bg = look?.bg ?? cfg.collageBg;
  const borderStyle = look?.border ?? cfg.photoBorder;
  const borderColor = look?.borderColor ?? cfg.photoBorderColor;
  const textColor = readableOn(bg, cfg.overlayColor);
  const stamp = look?.stamp ?? cfg.timestamp;
  const ar0 = aspectRatio(cfg);
  const caption = fillTemplate(cfg.polaroidText, cfg, date);
  // aspect ratio of one finished card (a Polaroid card is taller than the bare photo)
  const cardAr = cfg.polaroid ? (1 + 0.11) / (1 / ar0 + 0.055 + 0.2) : ar0;

  const { W, H, cells } = layoutCells(cfg.layout, cardAr);
  const footerText = cfg.overlayText ? fillTemplate(cfg.overlayText, cfg, date) : "";
  const footer = footerText ? Math.round(W * 0.085) : 0;
  const qrCol = cfg.qrOnPhoto && qrDataUrl ? Math.round(Math.min(W * 0.26, 440)) : 0;
  const qr = qrCol && qrDataUrl ? await loadImage(qrDataUrl) : null;

  const lw = W + qrCol;
  const lh = H + footer;
  const scale = maxDim ? Math.min(1, maxDim / Math.max(lw, lh)) : 1;
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  const out = newCanvas(maxDim ? even(lw * scale) : lw, maxDim ? even(lh * scale) : lh);
  const ctx = out.getContext("2d")!;

  const draw = (shots: HTMLCanvasElement[]) => {
    ctx.setTransform(out.width / lw, 0, 0, out.height / lh, 0, 0);
    ctx.imageSmoothingQuality = "high";
    let cards = shots.map((s) => cropToAspect(s, ar0, maxShotWidth));
    if (stamp) cards = cards.map((c) => stampPhoto(c, date));
    if (cfg.polaroid) cards = cards.map((c) => polaroidCard(c, caption));

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, lw, lh);

    cards.forEach((card, i) => {
      const c = cells[i];
      if (!c) return;
      ctx.save();
      if (cfg.polaroid) {
        const scale = 0.94;
        const tilt = cfg.polaroidRotate && cards.length > 1 ? ((i % 2 ? 1 : -1) * (1 + (i % 3) * 0.7) * Math.PI) / 180 : 0;
        ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
        ctx.rotate(tilt);
        ctx.shadowColor = "rgba(0,0,0,.35)";
        ctx.shadowBlur = c.w * 0.025;
        ctx.shadowOffsetY = c.w * 0.01;
        ctx.drawImage(card, (-c.w * scale) / 2, (-c.h * scale) / 2, c.w * scale, c.h * scale);
      } else {
        drawFramedPhoto(ctx, card, c, borderStyle, borderColor);
      }
      ctx.restore();
    });

    if (footerText) {
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.round(footer * 0.5)}px system-ui, "Segoe UI", sans-serif`;
      ctx.fillText(footerText, W / 2, H + footer / 2 - M * 0.2, W - 2 * M);
    }

    if (qr) {
      const size = qrCol - 60;
      const qx = W + (qrCol - size) / 2 - 10;
      const qy = (lh - size) / 2 - 20;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qx - 12, qy - 12, size + 24, size + 24);
      ctx.drawImage(qr, qx, qy, size, size);
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = `500 ${Math.round(size * 0.075)}px system-ui, "Segoe UI", sans-serif`;
      ctx.fillText("Scan to download", qx + size / 2, qy + size + 28, qrCol - 20);
    }

    if (cfg.frameMode === "color" && cfg.frameWidth > 0) {
      const w = cfg.frameWidth * (lw / 1800);
      ctx.strokeStyle = cfg.frameColor;
      ctx.lineWidth = w * 2; // half is clipped by the canvas edge
      ctx.strokeRect(0, 0, lw, lh);
    } else if (cfg.frameMode === "image" && frameImg?.complete && frameImg.naturalWidth) {
      ctx.drawImage(frameImg, 0, 0, lw, lh);
    }
    return out;
  };

  return { canvas: out, draw };
}

export async function compose({ shots, ...rest }: ComposeInput): Promise<HTMLCanvasElement> {
  const composer = await createComposer(rest);
  return composer.draw(shots);
}

export { loadImage };
