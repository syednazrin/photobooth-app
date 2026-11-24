// Chroma keying (green screen) on a 2D canvas. Compares colour in the CbCr plane so brightness changes matter less.

export interface ChromaOpts {
  key: string; // #rrggbb
  tolerance: number; // 0..1 — fully removed inside this distance
  softness: number; // 0..1 — soft edge beyond tolerance
  bgMode: "color" | "image";
  bgColor: string;
  bgImage: HTMLImageElement | null;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const cb = (r: number, g: number, b: number) => -0.168736 * r - 0.331264 * g + 0.5 * b;
const cr = (r: number, g: number, b: number) => 0.5 * r - 0.418688 * g - 0.081312 * b;

let scratch: HTMLCanvasElement | null = null;

/** Draw `source` keyed over the chosen background into `target` (already sized w x h). */
export function drawKeyed(
  target: HTMLCanvasElement,
  source: CanvasImageSource,
  w: number,
  h: number,
  mirror: boolean,
  o: ChromaOpts,
) {
  const tctx = target.getContext("2d")!;
  tctx.globalCompositeOperation = "source-over";

  // background
  if (o.bgMode === "image" && o.bgImage?.complete && o.bgImage.naturalWidth) {
    const s = Math.max(w / o.bgImage.naturalWidth, h / o.bgImage.naturalHeight);
    const dw = o.bgImage.naturalWidth * s;
    const dh = o.bgImage.naturalHeight * s;
    tctx.drawImage(o.bgImage, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    tctx.fillStyle = o.bgColor;
    tctx.fillRect(0, 0, w, h);
  }

  // subject
  if (!scratch) scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext("2d", { willReadFrequently: true })!;
  sctx.save();
  if (mirror) {
    sctx.translate(w, 0);
    sctx.scale(-1, 1);
  }
  sctx.drawImage(source, 0, 0, w, h);
  sctx.restore();

  const img = sctx.getImageData(0, 0, w, h);
  const d = img.data;
  const [kr, kg, kb] = hexToRgb(o.key);
  const kcb = cb(kr, kg, kb);
  const kcr = cr(kr, kg, kb);
  const scale = 180; // roughly the largest possible CbCr distance
  const t0 = o.tolerance * scale;
  const t1 = t0 + Math.max(o.softness * scale, 0.001);
  const dominant = kg >= kr && kg >= kb ? 1 : kr >= kb ? 0 : 2;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const dist = Math.hypot(cb(r, g, b) - kcb, cr(r, g, b) - kcr);
    let a = (dist - t0) / (t1 - t0);
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    a = a * a * (3 - 2 * a);
    if (a < 1 && a > 0) {
      // despill: pull the key colour back out of semi-transparent edge pixels
      const others = dominant === 0 ? Math.max(g, b) : dominant === 1 ? Math.max(r, b) : Math.max(r, g);
      if (d[i + dominant] > others) d[i + dominant] = others;
    }
    d[i + 3] = a * 255;
  }
  sctx.putImageData(img, 0, 0);
  tctx.drawImage(scratch, 0, 0);
}
