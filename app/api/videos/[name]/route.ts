import fs from "node:fs";
import { Readable } from "node:stream";
import { findVideo } from "@/lib/server/storage";

type Ctx = { params: Promise<{ name: string }> };

const TYPES = { mp4: "video/mp4", webm: "video/webm" } as const;

/** Serves a saved video. Supports Range requests, which Safari and iOS need to play video. */
export async function GET(request: Request, { params }: Ctx) {
  const { name } = await params;
  const v = await findVideo(name);
  if (!v) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": TYPES[v.ext],
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  if (new URL(request.url).searchParams.has("download")) {
    headers["Content-Disposition"] = `attachment; filename="${name}.${v.ext}"`;
  }

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  let start = 0;
  let end = v.size - 1;
  let status = 200;
  if (range && (range[1] || range[2])) {
    if (range[1]) {
      start = Number(range[1]);
      if (range[2]) end = Math.min(Number(range[2]), end);
    } else {
      start = Math.max(0, v.size - Number(range[2])); // "last N bytes"
    }
    if (start > end || start >= v.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${v.size}` } });
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${v.size}`;
  }
  headers["Content-Length"] = String(end - start + 1);

  const stream = Readable.toWeb(fs.createReadStream(v.file, { start, end })) as ReadableStream;
  return new Response(stream, { status, headers });
}
