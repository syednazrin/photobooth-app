import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { DEFAULT_CONFIG, sanitizeConfig, type Config } from "@/lib/config";

export const DATA_DIR = process.env.PHOTOBOOTH_DATA || path.join(process.cwd(), "data");
export const PHOTOS_DIR = path.join(DATA_DIR, "photos");
export const THUMBS_DIR = path.join(DATA_DIR, "thumbs");
export const VIDEOS_DIR = path.join(DATA_DIR, "videos");
export const ASSETS_DIR = path.join(DATA_DIR, "assets");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

export const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const ASSET_KINDS = ["frame", "background"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export interface PhotoInfo {
  name: string;
  width: number;
  height: number;
  size: number;
  mtime: number;
  video?: VideoExt;
}

export type VideoExt = "mp4" | "webm";
const VIDEO_EXTS: VideoExt[] = ["mp4", "webm"];

async function ensureDirs() {
  await Promise.all([PHOTOS_DIR, THUMBS_DIR, VIDEOS_DIR, ASSETS_DIR].map((d) => fs.mkdir(d, { recursive: true })));
}

export async function readConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    return sanitizeConfig(JSON.parse(raw), DEFAULT_CONFIG);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function writeConfig(cfg: Config): Promise<void> {
  await ensureDirs();
  await fs.writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
}

/** Decode a video data URL such as data:video/webm;codecs=vp9;base64,... */
export function decodeVideoDataUrl(dataUrl: unknown, maxBytes = 80 * 1024 * 1024): { buf: Buffer; ext: VideoExt } | null {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:video\/(webm|mp4)(?:;[^,;]*)*;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  return buf.length > 0 && buf.length <= maxBytes ? { buf, ext: m[1] as VideoExt } : null;
}

export function decodeDataUrl(dataUrl: unknown, maxBytes = 25 * 1024 * 1024): Buffer | null {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  return buf.length > 0 && buf.length <= maxBytes ? buf : null;
}

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Save a photo as JPEG plus a thumbnail. Never overwrites: a taken name gets a numeric suffix. */
export async function savePhoto(image: Buffer, wantedName: string): Promise<string> {
  await ensureDirs();
  let name = wantedName;
  for (let i = 1; await exists(path.join(PHOTOS_DIR, `${name}.jpg`)); i++) name = `${wantedName}-${i}`;
  const img = sharp(image).rotate().flatten({ background: "#ffffff" });
  await img.clone().jpeg({ quality: 92 }).toFile(path.join(PHOTOS_DIR, `${name}.jpg`));
  await img
    .clone()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 78 })
    .toFile(path.join(THUMBS_DIR, `${name}.jpg`));
  return name;
}

export async function saveVideo(name: string, buf: Buffer, ext: VideoExt): Promise<void> {
  if (!NAME_RE.test(name)) throw new Error("bad name");
  await ensureDirs();
  await fs.writeFile(path.join(VIDEOS_DIR, `${name}.${ext}`), buf);
}

export async function findVideo(name: string): Promise<{ file: string; ext: VideoExt; size: number } | null> {
  if (!NAME_RE.test(name)) return null;
  for (const ext of VIDEO_EXTS) {
    const file = path.join(VIDEOS_DIR, `${name}.${ext}`);
    try {
      const st = await fs.stat(file);
      return { file, ext, size: st.size };
    } catch {}
  }
  return null;
}

const metaCache = new Map<string, PhotoInfo>();

export async function listPhotos(): Promise<PhotoInfo[]> {
  await ensureDirs();
  const files = (await fs.readdir(PHOTOS_DIR)).filter((f) => f.endsWith(".jpg"));
  const out: PhotoInfo[] = [];
  const videos = new Map<string, VideoExt>();
  for (const f of await fs.readdir(VIDEOS_DIR)) {
    const m = /^([A-Za-z0-9_-]{1,64})\.(mp4|webm)$/.exec(f);
    if (m) videos.set(m[1], m[2] as VideoExt);
  }
  for (const f of files) {
    const name = f.slice(0, -4);
    if (!NAME_RE.test(name)) continue;
    const st = await fs.stat(path.join(PHOTOS_DIR, f));
    const key = `${name}:${st.mtimeMs}`;
    let info = metaCache.get(key);
    if (!info) {
      const meta = await sharp(path.join(PHOTOS_DIR, f)).metadata();
      info = { name, width: meta.width ?? 0, height: meta.height ?? 0, size: st.size, mtime: st.mtimeMs };
      metaCache.set(key, info);
    }
    out.push({ ...info, video: videos.get(name) });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

export async function readPhotoFile(name: string, thumb = false): Promise<Buffer | null> {
  if (!NAME_RE.test(name)) return null;
  try {
    return await fs.readFile(path.join(thumb ? THUMBS_DIR : PHOTOS_DIR, `${name}.jpg`));
  } catch {
    return null;
  }
}

export async function deletePhoto(name: string): Promise<boolean> {
  if (!NAME_RE.test(name)) return false;
  let removed = false;
  for (const dir of [PHOTOS_DIR, THUMBS_DIR]) {
    try {
      await fs.unlink(path.join(dir, `${name}.jpg`));
      removed = true;
    } catch {}
  }
  for (const ext of VIDEO_EXTS) {
    try {
      await fs.unlink(path.join(VIDEOS_DIR, `${name}.${ext}`));
    } catch {}
  }
  return removed;
}

export async function saveAsset(kind: AssetKind, image: Buffer): Promise<void> {
  await ensureDirs();
  await sharp(image).resize({ width: 3000, height: 3000, fit: "inside", withoutEnlargement: true }).png().toFile(path.join(ASSETS_DIR, `${kind}.png`));
}

export async function readAsset(kind: AssetKind): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(ASSETS_DIR, `${kind}.png`));
  } catch {
    return null;
  }
}

export async function deleteAsset(kind: AssetKind): Promise<void> {
  try {
    await fs.unlink(path.join(ASSETS_DIR, `${kind}.png`));
  } catch {}
}

async function dirSize(dir: string) {
  let total = 0;
  let count = 0;
  try {
    for (const f of await fs.readdir(dir)) {
      const st = await fs.stat(path.join(dir, f));
      if (st.isFile()) {
        total += st.size;
        count++;
      }
    }
  } catch {}
  return { total, count };
}

export async function diskUsage() {
  await ensureDirs();
  const [photos, thumbs, assets, videos] = await Promise.all([dirSize(PHOTOS_DIR), dirSize(THUMBS_DIR), dirSize(ASSETS_DIR), dirSize(VIDEOS_DIR)]);
  let free: number | null = null;
  let totalDisk: number | null = null;
  try {
    const s = await fs.statfs(DATA_DIR);
    free = s.bavail * s.bsize;
    totalDisk = s.blocks * s.bsize;
  } catch {}
  return { photos, thumbs, assets, videos, free, totalDisk, dataDir: DATA_DIR };
}
