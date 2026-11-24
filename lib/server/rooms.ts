import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { DATA_DIR } from "./storage";

const ROOMS_DIR = path.join(DATA_DIR, "rooms");
const TTL_MS = 2 * 60 * 60 * 1000; // rooms vanish after two hours
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_RE = /^[A-Z2-9]{5}$/;
export type Who = "a" | "b";
export const isWho = (v: unknown): v is Who => v === "a" || v === "b";

export interface Room {
  created: number;
  rows: number; // photos each person takes
  round: number;
  joined: boolean;
  ready: { a: boolean; b: boolean };
  startAt: number | null;
  uploaded: { a: number; b: number };
}

const dir = (code: string) => path.join(ROOMS_DIR, code);
const file = (code: string) => path.join(dir(code), "room.json");

async function sweep() {
  try {
    for (const c of await fs.readdir(ROOMS_DIR)) {
      const st = await fs.stat(path.join(ROOMS_DIR, c)).catch(() => null);
      if (st && Date.now() - st.mtimeMs > TTL_MS) await fs.rm(path.join(ROOMS_DIR, c), { recursive: true, force: true });
    }
  } catch {
    // nothing to sweep
  }
}

export async function readRoom(code: string): Promise<Room | null> {
  if (!CODE_RE.test(code)) return null;
  try {
    return JSON.parse(await fs.readFile(file(code), "utf8")) as Room;
  } catch {
    return null;
  }
}

async function writeRoom(code: string, r: Room) {
  await fs.writeFile(file(code), JSON.stringify(r), "utf8");
}

export async function createRoom(rows: number): Promise<string> {
  await fs.mkdir(ROOMS_DIR, { recursive: true });
  await sweep();
  for (;;) {
    const code = Array.from(crypto.randomBytes(5), (b) => ALPHABET[b % ALPHABET.length]).join("");
    if (await readRoom(code)) continue;
    await fs.mkdir(dir(code), { recursive: true });
    await writeRoom(code, {
      created: Date.now(),
      rows,
      round: 1,
      joined: false,
      ready: { a: false, b: false },
      startAt: null,
      uploaded: { a: 0, b: 0 },
    });
    return code;
  }
}

/** Read-modify-write one room. Rooms are tiny and used by two people, so a simple serial queue is enough. */
let chain: Promise<unknown> = Promise.resolve();
export function updateRoom(code: string, fn: (r: Room) => void): Promise<Room | null> {
  const run = chain.then(async () => {
    const r = await readRoom(code);
    if (!r) return null;
    fn(r);
    await writeRoom(code, r);
    return r;
  });
  chain = run.catch(() => {});
  return run;
}

const shotPath = (code: string, round: number, who: Who, i: number) => path.join(dir(code), `r${round}-${who}-${i}.jpg`);

export async function saveShot(code: string, round: number, who: Who, i: number, image: Buffer) {
  const jpg = await sharp(image).rotate().resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  await fs.writeFile(shotPath(code, round, who, i), jpg);
}

export async function readShot(code: string, round: number, who: Who, i: number): Promise<Buffer | null> {
  try {
    return await fs.readFile(shotPath(code, round, who, i));
  } catch {
    return null;
  }
}
