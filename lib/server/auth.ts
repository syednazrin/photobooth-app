import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DATA_DIR, readConfig } from "./storage";

const COOKIE = "pb_admin";
const SESSION_SECONDS = 60 * 60 * 12;
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
const SECRET_FILE = path.join(DATA_DIR, "secret");
export const DEFAULT_PASSWORD = "photobooth";

let secretCache: Buffer | null = null;

async function secret(): Promise<Buffer> {
  if (secretCache) return secretCache;
  try {
    secretCache = Buffer.from((await fs.readFile(SECRET_FILE, "utf8")).trim(), "hex");
  } catch {
    const s = crypto.randomBytes(32);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(SECRET_FILE, s.toString("hex"), { mode: 0o600 });
    secretCache = s;
  }
  return secretCache;
}

async function sign(value: string) {
  return crypto.createHmac("sha256", await secret()).update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export async function setPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(AUTH_FILE, JSON.stringify({ salt: salt.toString("hex"), hash: hash.toString("hex") }), { mode: 0o600 });
}

export async function usingDefaultPassword(): Promise<boolean> {
  if (process.env.ADMIN_PASSWORD) return false;
  try {
    await fs.access(AUTH_FILE);
    return false;
  } catch {
    return true;
  }
}

export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const { salt, hash } = JSON.parse(await fs.readFile(AUTH_FILE, "utf8"));
    const got = crypto.scryptSync(password, Buffer.from(salt, "hex"), 32).toString("hex");
    return safeEqual(got, hash);
  } catch {
    const expected = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
    const h = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
    return safeEqual(h(password), h(expected));
  }
}

export async function createSession() {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const value = `${exp}`;
  const jar = await cookies();
  jar.set(COOKIE, `${value}.${await sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await sign(exp));
}

export type GuardScope = "admin" | "start" | "gallery" | "manual";

/** Redirect to the login page when the scope is protected and the visitor is not logged in. */
export async function guard(scope: GuardScope, next: string) {
  if (await isAdmin()) return;
  if (scope !== "admin") {
    const cfg = await readConfig();
    const protectedScope =
      (scope === "start" && cfg.protectStart) ||
      (scope === "gallery" && cfg.protectGallery) ||
      (scope === "manual" && cfg.protectManual);
    if (!protectedScope) return;
  }
  redirect(`/login?next=${encodeURIComponent(next)}`);
}

// ---- tiny in-memory rate limiter (per client IP) ----
const hits = new Map<string, number[]>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  return false;
}
