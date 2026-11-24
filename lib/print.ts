import { PAPER_CSS, type PublicConfig } from "./config";

/**
 * Open the browser print dialog for one picture, sized to the chosen paper.
 * Browsers cannot print silently on their own: for kiosk use, start Chrome with --kiosk-printing.
 */
export function printPhoto(url: string, paper: PublicConfig["printPaper"], size: { width: number; height: number }) {
  const landscape = size.width > size.height;
  const page = `${PAPER_CSS[paper]}${landscape ? " landscape" : ""}`;
  const abs = new URL(url, window.location.origin).href;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: ${page}; margin: 0 }
html, body { margin: 0; height: 100%; background: #fff }
img { display: block; width: 100%; height: 100%; object-fit: contain }
</style></head><body><img src="${abs}" onload="window.focus();window.print()"></body></html>`;
  document.body.appendChild(frame);
  window.setTimeout(() => frame.remove(), 5 * 60_000);
}
