"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BORDER_LABELS, BORDER_STYLES, FILTER_IDS, LANGS, LAYOUT_IDS, LAYOUT_LABELS, STRIP_PRESETS, type Config } from "@/lib/config";

type Key = keyof Config;
const input = "px-3 py-2 rounded-lg bg-white/10 border border-white/25 w-full";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-none border border-white/15 p-5 flex flex-col gap-4">
      <legend className="px-2 text-lg font-light" style={{ color: "var(--accent)" }}>{title}</legend>
      {children}
    </fieldset>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid sm:grid-cols-[14rem_1fr] gap-1 sm:gap-4 items-start">
      <span className="pt-2">
        {label}
        {hint && <span className="block text-xs opacity-60">{hint}</span>}
      </span>
      <span>{children}</span>
    </label>
  );
}

function FileUpload({ kind, present, label }: { kind: "frame" | "background"; present: boolean; label: string }) {
  const [has, setHas] = useState(present);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const image = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error("read failed"));
      r.readAsDataURL(f);
    });
    const r = await fetch(`/api/asset/${kind}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });
    const data = await r.json().catch(() => ({}));
    setHas(r.ok);
    setMsg(r.ok ? "Uploaded." : data.error || "Upload failed");
  }
  async function remove() {
    await fetch(`/api/asset/${kind}`, { method: "DELETE" });
    setHas(false);
    setMsg("Removed.");
  }
  return (
    <Row label={label} hint={kind === "frame" ? "PNG with a transparent middle works best" : "Shown behind you when chroma keying"}>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="text-sm" />
      {has && (
        <span className="ml-3 text-sm">
          <a href={`/api/asset/${kind}`} target="_blank" className="underline">current</a>{" · "}
          <button type="button" onClick={remove} className="underline">remove</button>
        </span>
      )}
      {msg && <span className="block text-sm opacity-70">{msg}</span>}
    </Row>
  );
}

export default function AdminForm({
  initial,
  hasFrame,
  hasBackground,
}: {
  initial: Config;
  hasFrame: boolean;
  hasBackground: boolean;
}) {
  const [cfg, setCfg] = useState<Config>(initial);
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends Key>(k: K, v: Config[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const text = (k: Key, props: { type?: string; placeholder?: string } = {}) => (
    <input
      className={input}
      type={props.type ?? "text"}
      placeholder={props.placeholder}
      value={String(cfg[k] ?? "")}
      onChange={(e) => set(k, e.target.value as never)}
    />
  );
  const num = (k: Key, min: number, max: number, step = 1) => (
    <input
      className={input}
      type="number"
      min={min}
      max={max}
      step={step}
      value={Number(cfg[k])}
      onChange={(e) => set(k, (e.target.value === "" ? min : Number(e.target.value)) as never)}
    />
  );
  const check = (k: Key, label: string) => (
    <span className="flex items-center gap-2 pt-2">
      <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={Boolean(cfg[k])} onChange={(e) => set(k, e.target.checked as never)} />
      {label}
    </span>
  );
  const color = (k: Key) => (
    <input type="color" className="h-10 w-20 bg-transparent" value={String(cfg[k])} onChange={(e) => set(k, e.target.value as never)} />
  );
  const select = (k: Key, options: [string, string][]) => (
    <select className={input} value={String(cfg[k])} onChange={(e) => set(k, e.target.value as never)}>
      {options.map(([v, l]) => (
        <option key={v} value={v} className="text-black">{l}</option>
      ))}
    </select>
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cfg, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus({ ok: true, text: "Saved. Reload the booth page to apply." });
        setNewPassword("");
      } else {
        setStatus({ ok: false, text: data.error || "Could not save." });
      }
    } catch {
      setStatus({ ok: false, text: "Network error." });
    }
    setBusy(false);
  }

  const toggleFilter = (id: string) =>
    set("filters", cfg.filters.includes(id) ? cfg.filters.filter((f) => f !== id) : [...cfg.filters, id]);

  return (
    <form onSubmit={save} className="flex flex-col gap-6 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-3xl font-extralight tracking-widest">Admin</h1>
        <Link href="/admin/diskusage" className="underline">Disk usage</Link>
        <Link href="/manual" className="underline">Manual</Link>
        <Link href="/manual/faq" className="underline">FAQ</Link>
      </div>

      <Section title="General">
        <Row label="Language">{select("language", Object.entries(LANGS))}</Row>
        <Row label="Booth title">{text("title")}</Row>
        <Row label="Event line" hint="Shown on the start screen, e.g. Sam ♥ Alex">
          <span className="grid grid-cols-[1fr_5rem_1fr] gap-2">
            {text("eventLeft")}
            {text("eventSymbol")}
            {text("eventRight")}
          </span>
        </Row>
        <Row label="Public URL" hint="Used in QR codes. Use your computer's LAN address (e.g. http://192.168.1.20:3000) so phones can reach it.">
          {text("publicUrl", { placeholder: "http://192.168.1.20:3000" })}
        </Row>
        <Row label="File names">{select("filenameMode", [["date", "Date and time"], ["random", "Random"]])}</Row>
      </Section>

      <Section title="Style">
        <Row label="Accent colour">{color("accent")}</Row>
        <Row label="Background colour">{color("background")}</Row>
        <Row label="Text colour">{color("textColor")}</Row>
      </Section>

      <Section title="Capture">
        <Row label="Layout">{select("layout", LAYOUT_IDS.map((l) => [l, LAYOUT_LABELS[l]]))}</Row>
        <Row label="Photo shape">{select("photoAspect", [["3:2", "3:2"], ["4:3", "4:3"], ["16:9", "16:9"], ["1:1", "Square"]])}</Row>
        <Row label="Countdown (seconds)">{num("countdown", 0, 15)}</Row>
        <Row label="">{check("videoEnabled", "Offer a video mode (each shot is a short clip, saved as one video strip)")}</Row>
        <Row label="Video clip length (seconds)">{num("videoSeconds", 1, 10)}</Row>
        <Row label="Pause between photos (s)">{num("pauseBetween", 0, 15)}</Row>
        <Row label="">{check("previewEachShot", "Show each photo for a check (retake or continue) before the next one")}</Row>
        <Row label="">{check("waitBetweenShots", "Wait for a tap/key before each photo")}</Row>
        <Row label="">{check("mirror", "Mirror the camera (like a mirror)")}</Row>
        <Row label="Take-photo key" hint="Key code, e.g. Space, Enter, KeyB">{text("takeKey")}</Row>
        <Row label="Back to start after (s)" hint="0 = stay on the result">{num("resetAfter", 0, 600)}</Row>
      </Section>

      <Section title="Filters">
        <Row label="Available filters">
          <span className="flex flex-wrap gap-3 pt-2">
            {FILTER_IDS.map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={cfg.filters.includes(f)} onChange={() => toggleFilter(f)} id={`f-${f}`} />
                <label htmlFor={`f-${f}`}>{f}</label>
              </span>
            ))}
          </span>
        </Row>
        <Row label="Default filter">{select("defaultFilter", cfg.filters.map((f) => [f, f]))}</Row>
        <Row label="">{check("askFilter", "Let guests choose a filter after the photos")}</Row>
      </Section>

      <Section title="Picture look">
        <Row label="">{check("polaroid", "Polaroid effect")}</Row>
        <Row label="Polaroid caption" hint="{date} {time} {event}">{text("polaroidText")}</Row>
        <Row label="">{check("timestamp", "Date and time stamp on each photo")}</Row>
        <Row label="">{check("polaroidRotate", "Tilt Polaroids slightly in collages")}</Row>
        <Row label="Strip / collage colour" hint="Default base colour. Guests can change it after shooting.">
          <span className="flex flex-wrap gap-2 items-center">
            {STRIP_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.name}
                aria-label={p.name}
                aria-pressed={cfg.collageBg === p.bg}
                onClick={() => set("collageBg", p.bg)}
                style={{ background: p.bg }}
                className={`size-8 rounded-full border-2 ${cfg.collageBg === p.bg ? "border-[var(--accent)] scale-110" : "border-white/30"}`}
              />
            ))}
            {color("collageBg")}
          </span>
        </Row>
        <Row label="Photo border">{select("photoBorder", BORDER_STYLES.map((b) => [b, BORDER_LABELS[b]]))}</Row>
        <Row label="Photo border colour">{color("photoBorderColor")}</Row>
        <Row label="">{check("guestStyle", "Let guests choose strip colour and border after the photos")}</Row>
        <Row label="Frame">{select("frameMode", [["none", "None"], ["color", "Colour border"], ["image", "Image overlay"]])}</Row>
        <Row label="Border colour / width">
          <span className="flex gap-3 items-center">{color("frameColor")} {num("frameWidth", 0, 200)}</span>
        </Row>
        <FileUpload kind="frame" present={hasFrame} label="Frame image" />
        <Row label="Text under the picture" hint="{date} {time} {event}. Leave empty for none.">{text("overlayText")}</Row>
        <Row label="Text colour">{color("overlayColor")}</Row>
        <Row label="">{check("qrOnPhoto", "Print a QR code on the right side of the picture")}</Row>
        <Row label="">{check("showQr", "Show the QR code on the result screen")}</Row>
      </Section>

      <Section title="Chroma keying (green screen)">
        <Row label="">{check("chromaEnabled", "Enable chroma keying")}</Row>
        <Row label="Key colour">{color("chromaKey")}</Row>
        <Row label="Tolerance" hint="0 – 1">{num("chromaTolerance", 0, 1, 0.01)}</Row>
        <Row label="Edge softness" hint="0 – 1">{num("chromaSoftness", 0, 1, 0.01)}</Row>
        <Row label="Background">{select("chromaBgMode", [["color", "Solid colour"], ["image", "Uploaded image"]])}</Row>
        <Row label="Background colour">{color("chromaBgColor")}</Row>
        <FileUpload kind="background" present={hasBackground} label="Background image" />
      </Section>

      <Section title="Printing">
        <Row label="Print button">{select("printMode", [["off", "Hidden"], ["booth", "Booth only"], ["gallery", "Gallery only"], ["both", "Booth and gallery"]])}</Row>
        <Row label="">{check("autoPrint", "Print automatically after saving")}</Row>
        <Row label="Auto-print delay (s)">{num("autoPrintDelay", 0, 60)}</Row>
        <Row label="“Started printing” message (s)">{num("printMsgSeconds", 1, 60)}</Row>
        <Row label="Print key">{text("printKey")}</Row>
        <Row label="Paper size">{select("printPaper", [["4x6", "4 × 6 in"], ["a6", "A6"], ["a5", "A5"], ["a4", "A4"]])}</Row>
        <p className="text-sm opacity-70">
          Printing uses the browser&apos;s print dialog. For one-tap kiosk printing, start Chrome with{" "}
          <code>--kiosk-printing</code>.
        </p>
      </Section>

      <Section title="Email">
        <Row label="">{check("emailEnabled", "Let guests email their picture")}</Row>
        <Row label="SMTP host">{text("smtpHost", { placeholder: "smtp.example.com" })}</Row>
        <Row label="Port / secure">
          <span className="flex gap-3 items-center">{num("smtpPort", 1, 65535)} {check("smtpSecure", "TLS (port 465)")}</span>
        </Row>
        <Row label="SMTP user">{text("smtpUser")}</Row>
        <Row label="SMTP password" hint="Leave empty to keep the saved one">{text("smtpPass", { type: "password" })}</Row>
        <Row label="From address">{text("emailFrom", { placeholder: "photobooth@example.com" })}</Row>
        <Row label="Subject">{text("emailSubject")}</Row>
        <Row label="Message">{text("emailBody")}</Row>
      </Section>

      <Section title="Gallery & slideshow">
        <Row label="Gallery columns">{num("galleryColumns", 1, 8)}</Row>
        <Row label="">{check("galleryShowQr", "Show QR codes in the gallery")}</Row>
        <Row label="Slideshow seconds per photo">{num("slideshowSeconds", 1, 120)}</Row>
      </Section>

      <Section title="Access">
        <Row label="">{check("protectStart", "Require login for the booth page")}</Row>
        <Row label="">{check("protectGallery", "Require login for gallery & slideshow")}</Row>
        <Row label="">{check("protectManual", "Require login for manual & FAQ")}</Row>
        <Row label="New admin password" hint="At least 6 characters. Leave empty to keep the current one.">
          <input className={input} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Row>
      </Section>

      <div className="sticky bottom-0 py-3 flex items-center gap-4 bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] backdrop-blur">
        <button type="submit" disabled={busy} className="px-8 py-3 rounded-none bg-[var(--accent)] text-black font-medium disabled:opacity-50">
          {busy ? "Saving…" : "Save settings"}
        </button>
        {status && <p role="status" className={status.ok ? "" : "text-red-300"}>{status.text}</p>}
      </div>
    </form>
  );
}
