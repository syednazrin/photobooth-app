// Anime filter: AnimeGAN, Hayao (Studio Ghibli) style, running through onnxruntime-web in a worker.
// The model takes a fixed 672x504 image. Frames are resized to that, run, then stretched back.

const SW = 672, SH = 504;

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let pending: ((r: ArrayBuffer) => void) | null = null;
let pendingErr: ((e: Error) => void) | null = null;
let queue: Promise<unknown> = Promise.resolve();

function boot(): Promise<void> {
  if (ready) return ready;
  ready = new Promise<void>((resolve, reject) => {
    const w = new Worker("/anime-worker.js");
    worker = w;
    w.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "ready") resolve();
      else if (m.type === "result") pending?.(m.rgba);
      else if (m.type === "error") {
        const err = new Error(m.message);
        if (pendingErr) pendingErr(err);
        else reject(err);
      }
    };
    w.onerror = (e) => reject(new Error(e.message || "Anime worker failed"));
    w.postMessage({ type: "load", model: "/models/generator_hayao.onnx" });
  }).catch((e) => {
    ready = null;
    worker?.terminate();
    worker = null;
    throw e;
  });
  return ready;
}

/** Warm the model up in the background so the first photo is not slow. */
export function preloadAnime() {
  boot().catch(() => {});
}

async function runOne(src: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  await boot();
  const small = document.createElement("canvas");
  small.width = SW;
  small.height = SH;
  small.getContext("2d")!.drawImage(src, 0, 0, SW, SH);
  const rgba = small.getContext("2d")!.getImageData(0, 0, SW, SH).data;
  const buf = rgba.buffer.slice(0) as ArrayBuffer;

  const out = await new Promise<ArrayBuffer>((resolve, reject) => {
    pending = resolve;
    pendingErr = reject;
    worker!.postMessage({ type: "run", rgba: buf }, [buf]);
  });
  pending = pendingErr = null;

  small.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(out), SW, SH), 0, 0);
  const result = document.createElement("canvas");
  result.width = src.width;
  result.height = src.height;
  const ctx = result.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, src.width, src.height);
  return result;
}

/** Runs requests one at a time (the worker handles a single frame at once). */
export function animeFilter(src: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const job = queue.then(() => runOne(src));
  queue = job.catch(() => {});
  return job;
}
