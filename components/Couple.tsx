"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STRIP_PRESETS, type PublicConfig } from "@/lib/config";
import { compose, filterShots, loadImage, type LookChoice } from "@/lib/compose";

/**
 * Long-distance couples booth. Both people open the same room on their own device and take the same number of
 * photos at the same moment. The two sets are merged side by side: the room creator is the left column, the
 * other person the right column.
 */

type Who = "a" | "b";
type Phase = "lobby" | "ready" | "shooting" | "waiting" | "result";
interface RoomState {
  rows: number;
  round: number;
  joined: boolean;
  ready: { a: boolean; b: boolean };
  startAt: number | null;
  uploaded: { a: number; b: number };
  now: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const btnMain =
  "px-10 py-4 rounded-none bg-[var(--accent)] text-[var(--bg)] font-[family-name:var(--display)] text-2xl font-bold disabled:opacity-40 transition-transform hover:-translate-y-0.5 active:translate-y-px";
const btn =
  "px-5 py-2 rounded-none font-medium bg-[color-mix(in_srgb,var(--bg),white_8%)] hover:bg-[var(--accent)] hover:text-[var(--bg)] transition-colors disabled:opacity-40";
const chip = (on: boolean) =>
  `px-4 py-1.5 rounded-none border text-sm ${on ? "bg-[var(--accent)] text-[var(--bg)] border-transparent" : "border-white/30"}`;

export default function Couple({ cfg }: { cfg: PublicConfig }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const offsetRef = useRef(0);
  const aliveRef = useRef(true);
  const ranRound = useRef(0);
  const myRound = useRef(0);
  const finishing = useRef(false);
  const mineRef = useRef<HTMLCanvasElement[]>([]);
  const shotsRef = useRef<HTMLCanvasElement[]>([]);
  const composedRef = useRef<HTMLCanvasElement | null>(null);
  const cacheRef = useRef(new Map<string, HTMLCanvasElement[]>());

  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<Who>("a");
  const [rows, setRows] = useState<2 | 3>(2);
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [iReady, setIReady] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [hint, setHint] = useState("");
  const [shotIdx, setShotIdx] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("none");
  const [look, setLook] = useState<LookChoice>({ bg: cfg.collageBg, border: cfg.photoBorder, borderColor: cfg.photoBorderColor, stamp: true });
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const partner: Who = role === "a" ? "b" : "a";
  const clock = () => Date.now() + offsetRef.current;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ?room=CODE from a shared link
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("room");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (c) setJoinCode(c.toUpperCase().slice(0, 5));
  }, []);

  // ---- camera ----
  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCamError("Camera needs https or localhost.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = s;
        v.onloadedmetadata = () => setCamReady(true);
      })
      .catch((e: Error) => setCamError(e.message || "Camera unavailable"));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const grab = useCallback((): HTMLCanvasElement => {
    const v = videoRef.current!;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    if (cfg.mirror) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    return c;
  }, [cfg.mirror]);

  // ---- room polling ----
  useEffect(() => {
    if (!code) return;
    let stop = false;
    const tick = async () => {
      try {
        const t0 = Date.now();
        const res = await fetch(`/api/couple/${code}`, { cache: "no-store" });
        if (stop) return;
        if (res.status === 404) {
          setError("This room has expired. Start a new one.");
          setCode("");
          setPhase("lobby");
          return;
        }
        const r = (await res.json()) as RoomState;
        offsetRef.current = r.now - (t0 + Date.now()) / 2;
        setRoom(r);
      } catch {
        // offline for a moment: try again next tick
      }
    };
    void tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [code]);

  const post = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const res = await fetch(`/api/couple/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, who: role, ...extra }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error || "Request failed");
    },
    [code, role],
  );

  async function createRoom() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/couple", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
      const data = (await res.json()) as { code: string };
      setRole("a");
      setCode(data.code);
      setPhase("ready");
    } catch {
      setError("Could not create a room.");
    }
    setBusy(false);
  }

  async function joinRoom() {
    const c = joinCode.trim().toUpperCase();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/couple/${c}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Room not found. Check the code.");
      await fetch(`/api/couple/${c}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "join" }) });
      setRole("b");
      setCode(c);
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  // ---- a new round started (by either person) ----
  useEffect(() => {
    if (!room) return;
    if (myRound.current === 0) {
      myRound.current = room.round;
      return;
    }
    if (room.round !== myRound.current) {
      myRound.current = room.round;
      finishing.current = false;
      mineRef.current = [];
      shotsRef.current = [];
      composedRef.current = null;
      cacheRef.current.clear();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIReady(false);
      setResultUrl(null);
      setSaved(false);
      setShotIdx(0);
      setPhase("ready");
    }
  }, [room]);

  // ---- synchronised shooting ----
  const waitUntil = useCallback(async (t: number, label?: string) => {
    while (aliveRef.current && clock() < t) {
      if (label) setHint(`${label} ${Math.ceil((t - clock()) / 1000)}`);
      await sleep(Math.max(10, Math.min(100, t - clock())));
    }
  }, []);

  const upload = useCallback(
    async (i: number, canvas: HTMLCanvasElement) => {
      const w = Math.min(1400, canvas.width);
      const small = document.createElement("canvas");
      small.width = w;
      small.height = Math.round((canvas.height * w) / canvas.width);
      small.getContext("2d")!.drawImage(canvas, 0, 0, small.width, small.height);
      const image = small.toDataURL("image/jpeg", 0.88);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await post("upload", { index: i, image });
          return;
        } catch {
          await sleep(800);
        }
      }
      throw new Error("Could not send a photo. Check your connection.");
    },
    [post],
  );

  const shoot = useCallback(
    async (r: RoomState) => {
      const startAt = r.startAt!;
      const cd = cfg.countdown;
      const cycle = (cd + cfg.pauseBetween) * 1000;
      const uploads: Promise<void>[] = [];
      mineRef.current = [];
      setPhase("shooting");
      try {
        for (let i = 0; i < r.rows; i++) {
          const t0 = startAt + i * cycle;
          await waitUntil(t0, i === 0 ? "Starting in" : "Next photo in");
          setHint("");
          for (let n = cd; n > 0; n--) {
            setCount(n);
            await waitUntil(t0 + (cd - n + 1) * 1000);
          }
          setCount(null);
          const c = grab();
          mineRef.current.push(c);
          setShotIdx(i + 1);
          setFlashKey((k) => k + 1);
          uploads.push(upload(i, c));
        }
        setHint("");
        setPhase("waiting");
        await Promise.all(uploads);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [cfg.countdown, cfg.pauseBetween, grab, upload, waitUntil],
  );

  useEffect(() => {
    if (!room || phase !== "ready" || !room.startAt || !camReady) return;
    if (ranRound.current === room.round) return;
    ranRound.current = room.round;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void shoot(room);
  }, [room, phase, camReady, shoot]);

  // ---- merge once both sides are in ----
  const build = useCallback(
    async (filterId: string, lk: LookChoice) => {
      const filtered = await filterShots(shotsRef.current, filterId, cacheRef.current);
      const canvas = await compose({
        cfg: { ...cfg, layout: shotsRef.current.length === 6 ? "grid2x3" : "grid", qrOnPhoto: false },
        shots: filtered,
        look: lk,
      });
      composedRef.current = canvas;
      setResultUrl(canvas.toDataURL("image/jpeg", 0.92));
    },
    [cfg],
  );

  useEffect(() => {
    if (!room || phase !== "waiting" || finishing.current) return;
    if (room.uploaded[partner] < room.rows || mineRef.current.length < room.rows) return;
    finishing.current = true;
    (async () => {
      try {
        const theirs: HTMLCanvasElement[] = [];
        for (let i = 0; i < room.rows; i++) {
          const img = await loadImage(`/api/couple/${code}/shot/${partner}/${i}?round=${room.round}&t=${Date.now()}`);
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d")!.drawImage(img, 0, 0);
          theirs.push(c);
        }
        const [left, right] = role === "a" ? [mineRef.current, theirs] : [theirs, mineRef.current];
        shotsRef.current = left.flatMap((l, i) => [l, right[i]]);
        const start: LookChoice = { bg: cfg.collageBg, border: cfg.photoBorder, borderColor: cfg.photoBorderColor, stamp: true };
        setLook(start);
        setFilter("none");
        await build("none", start);
        setPhase("result");
      } catch {
        finishing.current = false;
        setError("Could not load your partner's photos. Retrying…");
      }
    })();
  }, [room, phase, partner, role, code, cfg.collageBg, cfg.photoBorder, cfg.photoBorderColor, build]);

  async function restyle(nextFilter: string, nextLook: LookChoice) {
    setFilter(nextFilter);
    setLook(nextLook);
    await build(nextFilter, nextLook);
  }

  async function saveToGallery() {
    if (!composedRef.current) return;
    setBusy(true);
    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: composedRef.current.toDataURL("image/jpeg", 0.92), name: `couple-${code}-${room?.round ?? 1}` }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
    } catch {
      setError("Could not save to the gallery.");
    }
    setBusy(false);
  }

  async function ready() {
    setIReady(true);
    try {
      await post("ready");
    } catch {
      setIReady(false);
      setError("Could not send. Try again.");
    }
  }

  const shareUrl = typeof window !== "undefined" && code ? `${window.location.origin}/couple?room=${code}` : "";
  const partnerReady = room ? room.ready[partner] : false;
  const showCam = phase !== "result" && !(phase === "lobby");

  return (
    <main className="flex flex-col items-center gap-6 pt-4 w-full max-w-3xl mx-auto">
      {phase === "lobby" && (
        <section className="w-full flex flex-col gap-8">
          <div>
            <h1 className="font-[family-name:var(--display)] text-6xl font-bold uppercase leading-[.9]">Couples booth</h1>
            <p className="mt-3 text-lg opacity-80 max-w-xl">
              Far apart? Take photos at the same moment on two devices. Your pictures are merged side by side into one strip.
            </p>
          </div>
          {error && <p role="alert" className="text-amber-300">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-6 bg-[color-mix(in_srgb,var(--bg),white_7%)] flex flex-col gap-4">
              <h2 className="font-[family-name:var(--display)] text-3xl font-bold uppercase">Start a room</h2>
              <div role="group" aria-label="Photos each" className="flex gap-2">
                <button type="button" className={chip(rows === 2)} aria-pressed={rows === 2} onClick={() => setRows(2)}>2 each (2 × 2)</button>
                <button type="button" className={chip(rows === 3)} aria-pressed={rows === 3} onClick={() => setRows(3)}>3 each (2 × 3)</button>
              </div>
              <button type="button" className={btnMain} disabled={busy} onClick={createRoom}>Create room</button>
            </div>
            <div className="p-6 bg-[color-mix(in_srgb,var(--bg),white_7%)] flex flex-col gap-4">
              <h2 className="font-[family-name:var(--display)] text-3xl font-bold uppercase">Join a room</h2>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                placeholder="CODE"
                aria-label="Room code"
                className="px-4 py-3 bg-transparent border border-white/30 rounded-none text-3xl tracking-[.3em] font-[family-name:var(--display)] uppercase"
              />
              <button type="button" className={btnMain} disabled={busy || joinCode.length !== 5} onClick={joinRoom}>Join</button>
            </div>
          </div>
        </section>
      )}

      <div className={`${showCam ? "" : "hidden"} w-full flex flex-col items-center gap-5`}>
        {phase === "ready" && (
          <div className="w-full flex flex-col items-center gap-3 text-center">
            <p className="text-sm opacity-70">Room code</p>
            <p className="font-[family-name:var(--display)] text-7xl font-bold tracking-[.2em] leading-none">{code}</p>
            {role === "a" && !room?.joined && (
              <>
                <p className="opacity-80">Send your partner this code or link, then wait here.</p>
                <button type="button" className={btn} onClick={() => navigator.clipboard?.writeText(shareUrl)}>Copy invite link</button>
              </>
            )}
            {room?.joined && (
              <p className="opacity-80">
                {role === "a" ? "Your partner is here." : "You are in."} You are the {role === "a" ? "left" : "right"} side. {room.rows} photos each.
              </p>
            )}
          </div>
        )}

        <div style={{ aspectRatio: cfg.photoAspect.replace(":", " / ") }} className="relative w-full overflow-hidden border border-white/20 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ transform: cfg.mirror ? "scaleX(-1)" : undefined }}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {count !== null && (
            <div className="absolute inset-0 grid place-items-center text-[10rem] font-thin bg-black/30" aria-live="assertive">{count}</div>
          )}
          {hint && (
            <div className="absolute inset-0 grid place-items-center text-4xl font-[family-name:var(--display)] font-bold uppercase bg-black/40" aria-live="polite">
              {hint}
            </div>
          )}
          {phase === "shooting" && count === null && !hint && (
            <div className="absolute top-3 left-3 px-3 py-1 bg-black/50 text-sm">Photo {shotIdx} of {room?.rows}</div>
          )}
          {flashKey > 0 && <div key={flashKey} className="absolute inset-0 bg-white pointer-events-none animate-[flash_.35s_ease-out_forwards]" />}
        </div>

        {camError && <p role="alert" className="text-red-300">{camError}</p>}

        {phase === "ready" && room?.joined && !room.startAt && (
          <div className="flex flex-col items-center gap-2">
            <button type="button" className={btnMain} disabled={!camReady || iReady} onClick={ready}>
              {iReady ? "Waiting for your partner…" : camReady ? "I'm ready" : "Starting camera…"}
            </button>
            <p className="text-sm opacity-70">
              {partnerReady ? "Your partner is ready." : "Photos start 5 seconds after you are both ready."}
            </p>
          </div>
        )}
        {phase === "ready" && room?.startAt && !count && !hint && <p className="opacity-80">Both ready. Get in frame!</p>}
        {phase === "waiting" && <p role="status" className="opacity-80">Photos sent. Waiting for your partner to finish…</p>}
        {error && phase !== "lobby" && <p role="alert" className="text-amber-300">{error}</p>}
      </div>

      {phase === "result" && resultUrl && (
        <section className="flex flex-col items-center gap-5 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt="Your merged photos" className="max-h-[70vh] w-auto max-w-full shadow-2xl" />

          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Filter">
            {cfg.filters.filter((f) => f !== "anime").map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} className={chip(filter === f)} onClick={() => restyle(f, look)}>{f}</button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2.5" role="group" aria-label="Strip colour">
            {STRIP_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.name}
                aria-label={p.name}
                aria-pressed={look.bg === p.bg}
                onClick={() => restyle(filter, { ...look, bg: p.bg })}
                style={{ background: p.bg }}
                className={`size-9 rounded-none border-2 transition-transform ${look.bg === p.bg ? "border-[var(--accent)] scale-125" : "border-white/30 hover:scale-110"}`}
              />
            ))}
          </div>
          <button type="button" aria-pressed={!!look.stamp} className={chip(!!look.stamp)} onClick={() => restyle(filter, { ...look, stamp: !look.stamp })}>
            Timestamp {look.stamp ? "on" : "off"}
          </button>

          <div className="flex flex-wrap justify-center gap-3">
            <a className={btnMain} href={resultUrl} download={`couple-${code}.jpg`}>Download</a>
            <button type="button" className={btn} disabled={busy || saved} onClick={saveToGallery}>{saved ? "Saved to gallery" : "Save to gallery"}</button>
            <button type="button" className={btn} onClick={() => post("again").catch(() => setError("Could not start another round."))}>Another round</button>
          </div>
          {error && <p role="alert" className="text-amber-300">{error}</p>}
        </section>
      )}
    </main>
  );
}
