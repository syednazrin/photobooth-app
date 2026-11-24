import crypto from "node:crypto";
import { isAdmin } from "@/lib/server/auth";
import { decodeDataUrl, decodeVideoDataUrl, listPhotos, NAME_RE, readConfig, savePhoto, saveVideo } from "@/lib/server/storage";

export async function GET() {
  const cfg = await readConfig();
  if (cfg.protectGallery && !(await isAdmin())) {
    return Response.json({ error: "Login required." }, { status: 401 });
  }
  return Response.json(await listPhotos(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const buf = decodeDataUrl(body?.image);
  if (!buf) return Response.json({ error: "Invalid image." }, { status: 400 });
  const video = body?.video == null ? null : decodeVideoDataUrl(body.video);
  if (body?.video != null && !video) return Response.json({ error: "Invalid video." }, { status: 400 });

  const cfg = await readConfig();
  let wanted = typeof body?.name === "string" && NAME_RE.test(body.name) ? body.name : "";
  if (!wanted) {
    wanted =
      cfg.filenameMode === "random"
        ? crypto.randomBytes(8).toString("hex")
        : new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  }
  try {
    const name = await savePhoto(buf, wanted);
    if (video) await saveVideo(name, video.buf, video.ext);
    return Response.json({ name });
  } catch {
    return Response.json({ error: "Could not process the image." }, { status: 400 });
  }
}
