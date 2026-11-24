"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BORDER_COLORS, BORDER_LABELS, BORDER_STYLES, LAYOUT_IDS, LAYOUT_LABELS, LAYOUT_SHOTS, STRIP_PRESETS, type LayoutId, type PublicConfig } from "@/lib/config";
import { drawKeyed, type ChromaOpts } from "@/lib/chroma";
import { compose, filterShots, loadImage, type LookChoice } from "@/lib/compose";
import { preloadAnime } from "@/lib/anime";
import { recordClip, renderVideo, videoSupported } from "@/lib/video";
import { useT } from "./I18n";
import { downloadUrl, makeQr, usePrint } from "./hooks";
import PhotoActions from "./PhotoActions";

type Phase = "idle" | "shooting" | "processing" | "review" | "saving" | "saved";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function newName(mode: PublicConfig["filenameMode"]) {
  if (mode === "random") {
    const b = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  }
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

const btnMain =
  "px-10 py-4 rounded-none bg-[var(--accent)] text-[var(--bg)] font-[family-name:var(--display)] text-2xl font-bold disabled:opacity-40 transition-transform hover:-translate-y-0.5 active:translate-y-px";
const btn = "px-5 py-2 rounded-none font-medium bg-[color-mix(in_srgb,var(--bg),white_8%)] hover:bg-[var(--accent)] hover:text-[var(--bg)] transition-colors disabled:opacity-40";

export default function Booth({ cfg: baseCfg }: { cfg: PublicConfig }) {
  const t = useT();
  const [layout, setLayout] = useState<LayoutId>(baseCfg.layout);
  const cfg = useMemo(() => ({ ...baseCfg, layout }), [baseCfg, layout]);
  const retakeRef = useRef<(() => void) | null>(null);
  const [shotPreview, setShotPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const shotsRef = useRef<HTMLCanvasElement[]>([]);
  const cacheRef = useRef(new Map<string, HTMLCanvasElement[]>());
  const composedRef = useRef<HTMLCanvasElement | null>(null);
  const nameRef = useRef("");
  const qrRef = useRef<string | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const frameImgRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const clipsRef = useRef<Blob[]>([]);
  const videoBlobRef = useRef<Blob | null>(null);
  const runModeRef = useRef<"photo" | "video">("photo");
  const tapRef = useRef<(() => void) | null>(null);
  const busyRef = useRef(false);
  const seqRef = useRef(0);
  const autoPrintTimer = useRef<number | undefined>(undefined);

  const [camError, setCamError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState<number | null>(null);
  const [shotIdx, setShotIdx] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [filter, setFilter] = useState(cfg.defaultFilter);
  const [look, setLook] = useState<LookChoice>({ bg: cfg.collageBg, border: cfg.photoBorder, borderColor: cfg.photoBorderColor, stamp: cfg.timestamp });
  const lookRef = useRef(look);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState({ width: 1, height: 1 });
  const [savedName, setSavedName] = useState<string | null>(null);
  const [canVideo, setCanVideo] = useState(false);
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [runMode, setRunMode] = useState<"photo" | "video">("photo");
  const [recording, setRecording] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [savedVideo, setSavedVideo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { printing, print } = usePrint(cfg);

  const total = LAYOUT_SHOTS[cfg.layout];
  const aspectStyle = useMemo(() => ({ aspectRatio: cfg.photoAspect.replace(":", " / ") }), [cfg.photoAspect]);
  const eventLine = [cfg.eventLeft, cfg.eventSymbol, cfg.eventRight].filter(Boolean).join("  ");

  useEffect(() => {
    // MediaRecorder only exists in the browser, so this is decided after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanVideo(cfg.videoEnabled && videoSupported());
  }, [cfg.videoEnabled]);

  // ---- camera ----
  useEffect(() => {
    let stream: MediaStream | undefined;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      // Camera access needs https or localhost.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCamError("getUserMedia unavailable (use https or localhost)");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((tr) => tr.stop());
        stream = s;
        streamRef.current = s;
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = s;
        v.onloadedmetadata = () => setReady(true);
      })
      .catch((e: Error) => setCamError(e.message || "error"));
    return () => {
      cancelled = true;
      streamRef.current = null;
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  useEffect(() => {
    if (ready && cfg.filters.includes("anime")) preloadAnime();
  }, [ready, cfg.filters]);

  // ---- background + frame images ----
  useEffect(() => {
    if (cfg.chromaEnabled && cfg.chromaBgMode === "image") {
      loadImage(`/api/asset/background?t=${Date.now()}`).then((i) => (bgImgRef.current = i), () => (bgImgRef.current = null));
    }
    if (cfg.frameMode === "image") {
      loadImage(`/api/asset/frame?t=${Date.now()}`).then((i) => (frameImgRef.current = i), () => (frameImgRef.current = null));
    }
  }, [cfg.chromaEnabled, cfg.chromaBgMode, cfg.frameMode]);

  const chromaOpts = useCallback(
    (): ChromaOpts => ({
      key: cfg.chromaKey,
      tolerance: cfg.chromaTolerance,
      softness: cfg.chromaSoftness,
      bgMode: cfg.chromaBgMode,
      bgColor: cfg.chromaBgColor,
      bgImage: bgImgRef.current,
    }),
    [cfg.chromaKey, cfg.chromaTolerance, cfg.chromaSoftness, cfg.chromaBgMode, cfg.chromaBgColor],
  );

  // ---- live chroma preview ----
  useEffect(() => {
    if (!cfg.chromaEnabled || !ready) return;
    let raf = 0;
    const loop = () => {
      const v = videoRef.current;
      const c = previewRef.current;
      if (v && c && v.videoWidth) {
        const w = 640;
        const h = Math.round((w * v.videoHeight) / v.videoWidth);
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        drawKeyed(c, v, w, h, cfg.mirror, chromaOpts());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cfg.chromaEnabled, cfg.mirror, ready, chromaOpts]);

  // ---- capture ----
  const grab = useCallback((): HTMLCanvasElement => {
    const v = videoRef.current!;
    const w = v.videoWidth;
    const h = v.videoHeight;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    if (cfg.chromaEnabled) {
      drawKeyed(c, v, w, h, cfg.mirror, chromaOpts());
    } else {
      const ctx = c.getContext("2d")!;
      if (cfg.mirror) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(v, 0, 0, w, h);
    }
    return c;
  }, [cfg.chromaEnabled, cfg.mirror, chromaOpts]);

  const build = useCallback(
    async (filterId: string, lk: LookChoice = lookRef.current) => {
      const seq = ++seqRef.current;
      if (runModeRef.current === "video") {
        setRendering(true);
        try {
          const { blob, poster } = await renderVideo({
            cfg,
            clips: clipsRef.current,
            filter: filterId === "anime" ? "none" : filterId,
            look: lk,
            qrDataUrl: qrRef.current,
            frameImg: frameImgRef.current,
            chroma: cfg.chromaEnabled ? chromaOpts() : null,
            seconds: cfg.videoSeconds,
          });
          if (seq !== seqRef.current) return null;
          setRendering(false);
          videoBlobRef.current = blob;
          composedRef.current = poster;
          setResultSize({ width: poster.width, height: poster.height });
          setResultUrl(poster.toDataURL("image/jpeg", 0.92));
          setVideoUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return URL.createObjectURL(blob);
          });
          return poster;
        } catch {
          if (seq === seqRef.current) {
            setRendering(false);
            busyRef.current = false;
            setPhase("idle");
            setMessage("Could not make the video. Please try again.");
          }
          return null;
        }
      }
      const filtered = await filterShots(shotsRef.current, filterId, cacheRef.current).catch(() => {
        setMessage("The anime filter could not load. Showing the original.");
        return shotsRef.current;
      });
      const canvas = await compose({
        cfg,
        shots: filtered,
        qrDataUrl: qrRef.current,
        frameImg: frameImgRef.current,
        look: lk,
      });
      if (seq !== seqRef.current) return null; // a newer request replaced this one
      composedRef.current = canvas;
      setResultSize({ width: canvas.width, height: canvas.height });
      setResultUrl(canvas.toDataURL("image/jpeg", 0.92));
      return canvas;
    },
    [cfg, chromaOpts],
  );

  const save = useCallback(async () => {
    const canvas = composedRef.current;
    if (!canvas) return;
    setPhase("saving");
    setMessage(null);
    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: canvas.toDataURL("image/jpeg", 0.92),
          name: nameRef.current,
          video: videoBlobRef.current ? await blobToDataUrl(videoBlobRef.current) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setSavedName(data.name);
      setSavedVideo(!!videoBlobRef.current);
      setPhase("saved");
      if (cfg.autoPrint && (cfg.printMode === "booth" || cfg.printMode === "both")) {
        autoPrintTimer.current = window.setTimeout(
          () => print(data.name, { width: canvas.width, height: canvas.height }),
          cfg.autoPrintDelay * 1000,
        );
      }
    } catch (e) {
      setMessage((e as Error).message);
      setPhase("review");
    }
  }, [cfg.autoPrint, cfg.autoPrintDelay, cfg.printMode, print]);

  const run = useCallback(async () => {
    if (busyRef.current || !ready) return;
    busyRef.current = true;
    seqRef.current++;
    shotsRef.current = [];
    clipsRef.current = [];
    videoBlobRef.current = null;
    cacheRef.current.clear();
    composedRef.current = null;
    window.clearTimeout(autoPrintTimer.current);
    const isVideo = mode === "video" && canVideo;
    runModeRef.current = isVideo ? "video" : "photo";
    setRunMode(runModeRef.current);
    const firstFilter = isVideo && cfg.defaultFilter === "anime" ? "none" : cfg.defaultFilter;
    setMessage(null);
    setSavedName(null);
    setSavedVideo(false);
    setResultUrl(null);
    setVideoUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setFilter(firstFilter);
    const fresh = { bg: cfg.collageBg, border: cfg.photoBorder, borderColor: cfg.photoBorderColor, stamp: cfg.timestamp };
    lookRef.current = fresh;
    setLook(fresh);
    setPhase("shooting");

    let skipPause = false;
    for (let i = 0; i < total; i++) {
      setShotIdx(i + 1);
      if (i > 0 && !skipPause) {
        if (cfg.waitBetweenShots) {
          setWaiting(true);
          await new Promise<void>((res) => (tapRef.current = res));
          tapRef.current = null;
          setWaiting(false);
        } else {
          await sleep(cfg.pauseBetween * 1000);
        }
      }
      skipPause = false;
      for (let n = cfg.countdown; n > 0; n--) {
        setCount(n);
        await sleep(1000);
      }
      setCount(null);
      if (isVideo) {
        setRecording(true);
        try {
          clipsRef.current.push(await recordClip(streamRef.current!, cfg.videoSeconds * 1000));
        } catch {
          setRecording(false);
          busyRef.current = false;
          setPhase("idle");
          setMessage("Recording failed. Please try again.");
          return;
        }
        setRecording(false);
      } else {
        shotsRef.current.push(grab());
      }
      setFlashKey((k) => k + 1);

      if (!isVideo && cfg.previewEachShot) {
        // let the guest check the photo before moving on
        setShotPreview(shotsRef.current[shotsRef.current.length - 1].toDataURL("image/jpeg", 0.85));
        const keep = await new Promise<boolean>((res) => {
          tapRef.current = () => res(true);
          retakeRef.current = () => res(false);
        });
        tapRef.current = null;
        retakeRef.current = null;
        setShotPreview(null);
        if (!keep) {
          shotsRef.current.pop();
          skipPause = true;
          i--;
        }
      }
    }

    setPhase("processing");
    nameRef.current = newName(cfg.filenameMode);
    qrRef.current = cfg.qrOnPhoto ? await makeQr(downloadUrl(nameRef.current, cfg)).catch(() => null) : null;
    const canvas = await build(firstFilter);
    busyRef.current = false;
    if (!canvas) return;
    if ((cfg.askFilter && cfg.filters.length > 1) || cfg.guestStyle) setPhase("review");
    else await save();
  }, [ready, cfg, total, grab, build, save, mode, canVideo]);

  const changeFilter = useCallback(
    async (id: string) => {
      setFilter(id);
      setPhase("processing");
      const canvas = await build(id);
      if (canvas) setPhase("review");
    },
    [build],
  );

  const changeLook = useCallback(
    async (patch: Partial<LookChoice>) => {
      const next = { ...lookRef.current, ...patch };
      lookRef.current = next;
      setLook(next);
      const canvas = await build(filter, next);
      if (canvas) setPhase("review");
    },
    [build, filter],
  );

  const reset = useCallback(() => {
    seqRef.current++;
    window.clearTimeout(autoPrintTimer.current);
    shotsRef.current = [];
    clipsRef.current = [];
    videoBlobRef.current = null;
    composedRef.current = null;
    setResultUrl(null);
    setVideoUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setSavedName(null);
    setMessage(null);
    setPhase("idle");
  }, []);

  const printSaved = useCallback(() => {
    if (savedName) print(savedName, resultSize);
  }, [savedName, print, resultSize]);

  // ---- keyboard + idle reset ----
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandler.current = (e) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.code === cfg.takeKey) {
        e.preventDefault();
        if (phase === "idle") run();
        else if (tapRef.current) tapRef.current();
      } else if (e.code === cfg.printKey && phase === "saved") {
        e.preventDefault();
        printSaved();
      }
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (phase !== "saved" || cfg.resetAfter <= 0) return;
    const id = window.setTimeout(reset, cfg.resetAfter * 1000);
    return () => window.clearTimeout(id);
  }, [phase, cfg.resetAfter, reset]);

  useEffect(() => () => window.clearTimeout(autoPrintTimer.current), []);

  // ---- render ----
  const showResult = phase === "review" || phase === "saving" || phase === "saved" || (phase === "processing" && resultUrl);
  const videoStyle = { filter: "none", transform: cfg.mirror ? "scaleX(-1)" : undefined };

  return (
    <main className="flex flex-col items-center gap-6 pt-4">
      {printing && (
        <div role="status" className="fixed inset-0 z-30 grid place-items-center bg-black/70 text-3xl text-center p-6">
          {t("printing")}
        </div>
      )}

      <div className={`${showResult ? "hidden" : ""} w-full max-w-3xl flex flex-col items-center gap-6`}>
        {phase === "idle" && eventLine && (
          <p className="text-3xl font-extralight tracking-[.25em] text-center">{eventLine}</p>
        )}

        {camError ? (
          <div role="alert" className="text-center">
            <p className="text-red-300 text-lg">{t("cameraError")}: {camError}</p>
            <p className="opacity-70">{t("cameraHelp")}</p>
          </div>
        ) : (
          <div style={aspectStyle} className="relative w-full rounded-none overflow-hidden border border-white/20 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={videoStyle}
              className={`absolute inset-0 w-full h-full object-cover ${cfg.chromaEnabled ? "invisible" : ""}`}
            />
            {cfg.chromaEnabled && (
              <canvas ref={previewRef} className="absolute inset-0 w-full h-full object-cover" />
            )}
            {shotPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shotPreview} alt="Photo just taken" className="absolute inset-0 w-full h-full object-cover" />
            )}
            {count !== null && (
              <div className="absolute inset-0 grid place-items-center text-[10rem] font-thin bg-black/30" aria-live="assertive">
                {count}
              </div>
            )}
            {phase === "shooting" && count === null && !waiting && !shotPreview && (
              <div className="absolute top-3 left-3 px-3 py-1 rounded-none bg-black/50 text-sm flex items-center gap-2">
                {recording && <span className="size-2.5 rounded-full bg-red-500 animate-pulse" />}
                {recording ? t("recording") : t("shotOf", { n: shotIdx, total })}
              </div>
            )}
            {flashKey > 0 && <div key={flashKey} className="absolute inset-0 bg-white pointer-events-none animate-[flash_.35s_ease-out_forwards]" />}
          </div>
        )}

        {phase === "idle" && message && <p role="alert" className="text-amber-300">{message}</p>}
        {phase === "idle" && !camError && canVideo && (
          <div role="group" className="flex gap-2">
            {(["photo", "video"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`px-5 py-1.5 rounded-none border text-sm ${
                  mode === m ? "bg-[var(--accent)] text-black border-transparent" : "border-white/30"
                }`}
              >
                {m === "photo" ? t("modePhoto") : t("modeVideo")}
              </button>
            ))}
          </div>
        )}
        {phase === "idle" && !camError && (
          <div role="group" aria-label="Layout" className="flex flex-wrap justify-center gap-2">
            {LAYOUT_IDS.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={layout === l}
                onClick={() => setLayout(l)}
                className={`px-4 py-1.5 rounded-none border text-sm ${
                  layout === l ? "bg-[var(--accent)] text-[var(--bg)] border-transparent" : "border-white/30"
                }`}
              >
                {LAYOUT_LABELS[l]}
              </button>
            ))}
          </div>
        )}
        {phase === "idle" && !camError && (
          <div className="flex flex-col items-center gap-2">
            <button type="button" className={btnMain} disabled={!ready} onClick={run}>
              {ready ? t("start") : t("loading")}
            </button>
            <p className="text-sm opacity-60">{t("keyHint", { key: cfg.takeKey.replace(/^Key|^Digit/, "") })}</p>
          </div>
        )}
        {shotPreview && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm opacity-70">{t("shotOf", { n: shotIdx, total })}. Happy with it?</p>
            <div className="flex gap-3">
              <button type="button" className={btn} onClick={() => retakeRef.current?.()}>Retake this one</button>
              <button type="button" className={btnMain} onClick={() => tapRef.current?.()}>
                {shotIdx < total ? "Looks good, next" : "Looks good, finish"}
              </button>
            </div>
          </div>
        )}
        {waiting && (
          <button type="button" className={btnMain} onClick={() => tapRef.current?.()}>
            {t("tapNext")}
          </button>
        )}
        {phase === "processing" && !resultUrl && <p role="status" className="opacity-80">{t("processing")}</p>}
      </div>

      {showResult && (
        <section className="flex flex-col items-center gap-5 w-full">
          {videoUrl && (
            <video
              key={videoUrl}
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className={`max-h-[62vh] w-auto max-w-full rounded shadow-2xl ${phase === "processing" ? "opacity-50" : ""}`}
            />
          )}
          {resultUrl && !videoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resultUrl}
              alt="Your photos"
              className={`max-h-[62vh] w-auto max-w-full rounded shadow-2xl ${phase === "processing" ? "opacity-50" : ""}`}
            />
          )}
          {phase === "processing" && <p role="status" className="opacity-80">{runMode === "video" ? t("makingVideo") : t("processing")}</p>}

          {phase === "review" && cfg.guestStyle && (
            <div className="flex flex-col items-center gap-4 w-full max-w-xl">
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm opacity-70">{t("stripColor")}</p>
                <div className="flex flex-wrap justify-center gap-2.5">
                  {STRIP_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={p.name}
                      aria-label={p.name}
                      aria-pressed={look.bg === p.bg}
                      onClick={() => changeLook({ bg: p.bg })}
                      style={{ background: p.bg }}
                      className={`size-9 rounded-full border-2 transition-transform ${
                        look.bg === p.bg ? "border-[var(--accent)] scale-125" : "border-white/30 hover:scale-110"
                      }`}
                    />
                  ))}
                  <label className="size-9 rounded-full border-2 border-dashed border-white/40 grid place-items-center cursor-pointer text-sm" title="Custom colour">
                    +
                    <input type="color" className="sr-only" value={look.bg} onChange={(e) => changeLook({ bg: e.target.value })} />
                  </label>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm opacity-70">{t("photoBorder")}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {BORDER_STYLES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      aria-pressed={look.border === b}
                      onClick={() => changeLook({ border: b })}
                      className={`px-3.5 py-1 rounded-none border text-sm ${
                        look.border === b ? "bg-[var(--accent)] text-black border-transparent" : "border-white/30"
                      }`}
                    >
                      {BORDER_LABELS[b]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm opacity-70">Timestamp</p>
                <button
                  type="button"
                  aria-pressed={!!look.stamp}
                  onClick={() => changeLook({ stamp: !look.stamp })}
                  className={`px-3.5 py-1 rounded-none border text-sm ${
                    look.stamp ? "bg-[var(--accent)] text-[var(--bg)] border-transparent" : "border-white/30"
                  }`}
                >
                  {look.stamp ? "On" : "Off"}
                </button>
              </div>
              {look.border !== "none" && look.border !== "float" && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm opacity-70">{t("borderColor")}</p>
                  <div className="flex gap-2.5">
                    {BORDER_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={c}
                        aria-pressed={look.borderColor === c}
                        onClick={() => changeLook({ borderColor: c })}
                        style={{ background: c }}
                        className={`size-7 rounded-full border-2 transition-transform ${
                          look.borderColor === c ? "border-[var(--accent)] scale-125" : "border-white/30 hover:scale-110"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === "review" && cfg.askFilter && cfg.filters.length > 1 && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm opacity-70">{t("chooseFilter")}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {cfg.filters.filter((f) => !(runMode === "video" && f === "anime")).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => changeFilter(f)}
                    aria-pressed={filter === f}
                    className={`px-4 py-1.5 rounded-none border text-sm ${
                      filter === f ? "bg-[var(--accent)] text-black border-transparent" : "border-white/30"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {rendering && phase === "review" && <p role="status" className="opacity-80">{t("makingVideo")}</p>}
          {message && <p role="alert" className="text-amber-300">{message}</p>}

          {(phase === "review" || phase === "saving") && (
            <div className="flex gap-3">
              <button type="button" className={btn} onClick={reset} disabled={phase === "saving" || rendering}>
                {t("retake")}
              </button>
              <button type="button" className={btnMain} onClick={save} disabled={phase === "saving" || rendering}>
                {phase === "saving" ? t("saving") : t("save")}
              </button>
            </div>
          )}

          {phase === "saved" && savedName && (
            <>
              <p className="text-lg" style={{ color: "var(--accent)" }}>{t("saved")}</p>
              <PhotoActions name={savedName} cfg={cfg} context="booth" showQr={cfg.showQr} onPrint={printSaved} video={savedVideo} />
              <button type="button" className={btnMain} onClick={reset}>
                {t("newPhoto")}
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
