import { isAdmin } from "@/lib/server/auth";
import { ASSET_KINDS, decodeDataUrl, deleteAsset, readAsset, saveAsset, type AssetKind } from "@/lib/server/storage";

type Ctx = { params: Promise<{ kind: string }> };

const asKind = (k: string): AssetKind | null => (ASSET_KINDS as readonly string[]).includes(k) ? (k as AssetKind) : null;

export async function GET(_req: Request, { params }: Ctx) {
  const kind = asKind((await params).kind);
  const file = kind && (await readAsset(kind));
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function PUT(request: Request, { params }: Ctx) {
  if (!(await isAdmin())) return Response.json({ error: "Not logged in." }, { status: 401 });
  const kind = asKind((await params).kind);
  const body = await request.json().catch(() => null);
  const buf = decodeDataUrl(body?.image, 15 * 1024 * 1024);
  if (!kind || !buf) return Response.json({ error: "Invalid image." }, { status: 400 });
  try {
    await saveAsset(kind, buf);
  } catch {
    return Response.json({ error: "Could not process the image." }, { status: 400 });
  }
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await isAdmin())) return Response.json({ error: "Not logged in." }, { status: 401 });
  const kind = asKind((await params).kind);
  if (!kind) return Response.json({ error: "Unknown asset." }, { status: 400 });
  await deleteAsset(kind);
  return Response.json({ ok: true });
}
