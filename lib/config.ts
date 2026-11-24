// Shared settings model. Safe to import from both server and client code.

export const LANGS = {
  en: "English",
  ms: "Bahasa Melayu",
  de: "Deutsch",
  es: "Español",
} as const;
export type Lang = keyof typeof LANGS;

export const FILTER_CSS: Record<string, string> = {
  none: "none",
  mono: "grayscale(1) contrast(1.1)",
  sepia: "sepia(0.9) contrast(1.05)",
  warm: "saturate(1.3) hue-rotate(-10deg) brightness(1.05)",
  cool: "saturate(1.1) hue-rotate(15deg) brightness(1.02)",
  vivid: "saturate(1.6) contrast(1.12)",
  fade: "contrast(0.88) brightness(1.08) saturate(0.85)",
  vintage: "sepia(0.35) contrast(0.95) brightness(1.06) saturate(1.25) hue-rotate(-8deg)", // plus grain and vignette, see lib/compose.ts
  grainy: "grayscale(0.2) contrast(1.18) brightness(1.02)", // plus heavy grain, see lib/compose.ts
  anime: "none", // handled by the neural filter, see lib/anime.ts
};
export const FILTER_IDS = Object.keys(FILTER_CSS);

export const LAYOUT_SHOTS = { single: 1, strip: 4, grid: 4, grid6: 6, grid2x3: 6, row3: 3, feature: 3 } as const;
export type LayoutId = keyof typeof LAYOUT_SHOTS;
export const LAYOUT_IDS = Object.keys(LAYOUT_SHOTS) as LayoutId[];
export const LAYOUT_LABELS: Record<LayoutId, string> = {
  single: "Single photo",
  strip: "Vertical strip (4)",
  grid: "2 × 2 grid (4)",
  grid6: "3 × 2 grid (6)",
  grid2x3: "2 × 3 grid (6)",
  row3: "Row of 3",
  feature: "1 large + 2 small (3)",
};

export interface StripPreset { id: string; name: string; bg: string }
/** Base colours offered for the photo strip / collage background. */
export const STRIP_PRESETS: StripPreset[] = [
  { id: "maroon", name: "Maroon", bg: "#5b1a2a" },
  { id: "black", name: "Black", bg: "#111111" },
  { id: "cream", name: "Cream", bg: "#f4f1ec" },
  { id: "blush", name: "Blush pink", bg: "#f2c9cf" },
  { id: "dustyrose", name: "Dusty rose", bg: "#c98b95" },
  { id: "lavender", name: "Lavender", bg: "#c9b8e8" },
  { id: "sage", name: "Sage", bg: "#a9b9a0" },
  { id: "forest", name: "Forest green", bg: "#23402f" },
  { id: "navy", name: "Navy", bg: "#1b2a49" },
  { id: "mocha", name: "Mocha", bg: "#6f4e37" },
  { id: "butter", name: "Butter", bg: "#f3e3a4" },
  { id: "white", name: "White", bg: "#ffffff" },
];

export const BORDER_STYLES = ["none", "thin", "thick", "rounded", "double", "float"] as const;
export type BorderStyle = (typeof BORDER_STYLES)[number];
export const BORDER_LABELS: Record<BorderStyle, string> = {
  none: "None",
  thin: "Thin",
  thick: "Thick",
  rounded: "Rounded",
  double: "Double line",
  float: "Floating",
};
/** Border colours guests can pick. */
export const BORDER_COLORS = ["#ffffff", "#111111", "#d4af37", "#f4f1ec", "#c98b95", "#5b1a2a"];

export interface Config {
  // general
  language: Lang;
  title: string;
  eventLeft: string;
  eventSymbol: string;
  eventRight: string;
  // style
  accent: string;
  background: string;
  textColor: string;
  // capture
  mirror: boolean;
  layout: LayoutId;
  photoAspect: "3:2" | "4:3" | "16:9" | "1:1";
  countdown: number;
  videoEnabled: boolean;
  videoSeconds: number;
  pauseBetween: number;
  previewEachShot: boolean;
  timestamp: boolean;
  waitBetweenShots: boolean;
  takeKey: string;
  resetAfter: number;
  // filters
  filters: string[];
  defaultFilter: string;
  askFilter: boolean;
  // look of the picture
  polaroid: boolean;
  polaroidText: string;
  polaroidRotate: boolean;
  collageBg: string;
  photoBorder: BorderStyle;
  photoBorderColor: string;
  guestStyle: boolean;
  frameMode: "none" | "color" | "image";
  frameColor: string;
  frameWidth: number;
  overlayText: string;
  overlayColor: string;
  qrOnPhoto: boolean;
  showQr: boolean;
  publicUrl: string;
  filenameMode: "date" | "random";
  // chroma keying
  chromaEnabled: boolean;
  chromaKey: string;
  chromaTolerance: number;
  chromaSoftness: number;
  chromaBgMode: "color" | "image";
  chromaBgColor: string;
  // printing
  printMode: "off" | "booth" | "gallery" | "both";
  autoPrint: boolean;
  autoPrintDelay: number;
  printMsgSeconds: number;
  printKey: string;
  printPaper: "4x6" | "a6" | "a5" | "a4";
  // email
  emailEnabled: boolean;
  emailSubject: string;
  emailBody: string;
  emailFrom: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  // gallery / slideshow
  galleryColumns: number;
  galleryShowQr: boolean;
  slideshowSeconds: number;
  // access
  protectStart: boolean;
  protectGallery: boolean;
  protectManual: boolean;
}

export const SERVER_ONLY_KEYS = [
  "emailFrom",
  "smtpHost",
  "smtpPort",
  "smtpSecure",
  "smtpUser",
  "smtpPass",
] as const;
export type PublicConfig = Omit<Config, (typeof SERVER_ONLY_KEYS)[number]>;

export const DEFAULT_CONFIG: Config = {
  language: "en",
  title: "photobooth",
  eventLeft: "",
  eventSymbol: "",
  eventRight: "",
  accent: "#ff99d3",
  background: "#3d0012",
  textColor: "#ff99d3",
  mirror: true,
  layout: "strip",
  photoAspect: "3:2",
  countdown: 3,
  videoEnabled: true,
  videoSeconds: 3,
  pauseBetween: 5,
  previewEachShot: true,
  timestamp: false,
  waitBetweenShots: false,
  takeKey: "Space",
  resetAfter: 0,
  filters: ["none", "mono", "sepia", "warm", "cool", "vivid", "fade", "vintage", "grainy", "anime"],
  defaultFilter: "none",
  askFilter: true,
  polaroid: false,
  polaroidText: "{date}",
  polaroidRotate: true,
  collageBg: "#5b1a2a",
  photoBorder: "thin",
  photoBorderColor: "#ffffff",
  guestStyle: true,
  frameMode: "none",
  frameColor: "#222222",
  frameWidth: 24,
  overlayText: "{date}",
  overlayColor: "#f4f1ec",
  qrOnPhoto: false,
  showQr: true,
  publicUrl: "",
  filenameMode: "date",
  chromaEnabled: false,
  chromaKey: "#00b140",
  chromaTolerance: 0.16,
  chromaSoftness: 0.1,
  chromaBgMode: "color",
  chromaBgColor: "#1b2a49",
  printMode: "both",
  autoPrint: false,
  autoPrintDelay: 2,
  printMsgSeconds: 6,
  printKey: "KeyP",
  printPaper: "4x6",
  emailEnabled: false,
  emailSubject: "Your photobooth picture",
  emailBody: "Thanks for stopping by! Your picture is attached.",
  emailFrom: "",
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  galleryColumns: 4,
  galleryShowQr: true,
  slideshowSeconds: 5,
  protectStart: false,
  protectGallery: false,
  protectManual: false,
};

type Spec =
  | { t: "str"; max?: number }
  | { t: "bool" }
  | { t: "num"; min: number; max: number; int?: boolean }
  | { t: "enum"; v: readonly string[] }
  | { t: "color" }
  | { t: "filters" };

const COLOR = /^#[0-9a-fA-F]{6}$/;

const SPEC: Record<keyof Config, Spec> = {
  language: { t: "enum", v: Object.keys(LANGS) },
  title: { t: "str", max: 60 },
  eventLeft: { t: "str", max: 40 },
  eventSymbol: { t: "str", max: 8 },
  eventRight: { t: "str", max: 40 },
  accent: { t: "color" },
  background: { t: "color" },
  textColor: { t: "color" },
  mirror: { t: "bool" },
  layout: { t: "enum", v: LAYOUT_IDS },
  photoAspect: { t: "enum", v: ["3:2", "4:3", "16:9", "1:1"] },
  countdown: { t: "num", min: 0, max: 15, int: true },
  videoEnabled: { t: "bool" },
  videoSeconds: { t: "num", min: 1, max: 10, int: true },
  pauseBetween: { t: "num", min: 0, max: 15, int: true },
  previewEachShot: { t: "bool" },
  timestamp: { t: "bool" },
  waitBetweenShots: { t: "bool" },
  takeKey: { t: "str", max: 20 },
  resetAfter: { t: "num", min: 0, max: 600, int: true },
  filters: { t: "filters" },
  defaultFilter: { t: "enum", v: FILTER_IDS },
  askFilter: { t: "bool" },
  polaroid: { t: "bool" },
  polaroidText: { t: "str", max: 80 },
  polaroidRotate: { t: "bool" },
  collageBg: { t: "color" },
  photoBorder: { t: "enum", v: BORDER_STYLES },
  photoBorderColor: { t: "color" },
  guestStyle: { t: "bool" },
  frameMode: { t: "enum", v: ["none", "color", "image"] },
  frameColor: { t: "color" },
  frameWidth: { t: "num", min: 0, max: 200, int: true },
  overlayText: { t: "str", max: 120 },
  overlayColor: { t: "color" },
  qrOnPhoto: { t: "bool" },
  showQr: { t: "bool" },
  publicUrl: { t: "str", max: 200 },
  filenameMode: { t: "enum", v: ["date", "random"] },
  chromaEnabled: { t: "bool" },
  chromaKey: { t: "color" },
  chromaTolerance: { t: "num", min: 0, max: 1 },
  chromaSoftness: { t: "num", min: 0, max: 1 },
  chromaBgMode: { t: "enum", v: ["color", "image"] },
  chromaBgColor: { t: "color" },
  printMode: { t: "enum", v: ["off", "booth", "gallery", "both"] },
  autoPrint: { t: "bool" },
  autoPrintDelay: { t: "num", min: 0, max: 60, int: true },
  printMsgSeconds: { t: "num", min: 1, max: 60, int: true },
  printKey: { t: "str", max: 20 },
  printPaper: { t: "enum", v: ["4x6", "a6", "a5", "a4"] },
  emailEnabled: { t: "bool" },
  emailSubject: { t: "str", max: 120 },
  emailBody: { t: "str", max: 1000 },
  emailFrom: { t: "str", max: 120 },
  smtpHost: { t: "str", max: 200 },
  smtpPort: { t: "num", min: 1, max: 65535, int: true },
  smtpSecure: { t: "bool" },
  smtpUser: { t: "str", max: 200 },
  smtpPass: { t: "str", max: 200 },
  galleryColumns: { t: "num", min: 1, max: 8, int: true },
  galleryShowQr: { t: "bool" },
  slideshowSeconds: { t: "num", min: 1, max: 120, int: true },
  protectStart: { t: "bool" },
  protectGallery: { t: "bool" },
  protectManual: { t: "bool" },
};

/** Merge `input` over `base`, keeping only valid values. Unknown keys and bad values are dropped. */
export function sanitizeConfig(input: unknown, base: Config = DEFAULT_CONFIG): Config {
  const out: Record<string, unknown> = { ...base };
  if (!input || typeof input !== "object") return out as unknown as Config;
  const src = input as Record<string, unknown>;
  for (const key of Object.keys(SPEC) as (keyof Config)[]) {
    if (!(key in src)) continue;
    const v = src[key];
    const s = SPEC[key];
    switch (s.t) {
      case "str":
        if (typeof v === "string") out[key] = v.slice(0, s.max ?? 200);
        break;
      case "bool":
        if (typeof v === "boolean") out[key] = v;
        break;
      case "num":
        if (typeof v === "number" && Number.isFinite(v)) {
          const n = Math.min(s.max, Math.max(s.min, v));
          out[key] = s.int ? Math.round(n) : n;
        }
        break;
      case "enum":
        if (typeof v === "string" && s.v.includes(v)) out[key] = v;
        break;
      case "color":
        if (typeof v === "string" && COLOR.test(v)) out[key] = v;
        break;
      case "filters":
        if (Array.isArray(v)) {
          const list = v.filter((f): f is string => typeof f === "string" && FILTER_IDS.includes(f));
          out[key] = list.length ? Array.from(new Set(list)) : ["none"];
        }
        break;
    }
  }
  const cfg = out as unknown as Config;
  if (!cfg.filters.includes(cfg.defaultFilter)) cfg.defaultFilter = cfg.filters[0];
  return cfg;
}

export function toPublic(cfg: Config): PublicConfig {
  const copy: Partial<Config> = { ...cfg };
  for (const k of SERVER_ONLY_KEYS) delete copy[k];
  return copy as PublicConfig;
}

export const PAPER_CSS: Record<Config["printPaper"], string> = {
  "4x6": "4in 6in",
  a6: "105mm 148mm",
  a5: "148mm 210mm",
  a4: "210mm 297mm",
};

/** Fill {date}, {time}, {event} in user-provided text. */
export function fillTemplate(tpl: string, cfg: Pick<PublicConfig, "eventLeft" | "eventSymbol" | "eventRight">, d = new Date()): string {
  const event = [cfg.eventLeft, cfg.eventSymbol, cfg.eventRight].filter(Boolean).join(" ");
  return tpl
    .replaceAll("{date}", d.toLocaleDateString())
    .replaceAll("{time}", d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
    .replaceAll("{event}", event);
}
