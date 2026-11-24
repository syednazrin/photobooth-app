import { isAdmin } from "@/lib/server/auth";
import { deletePhoto, readPhotoFile } from "@/lib/server/storage";

type Ctx = { params: Promise<{ name: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { name } = await params;
  const url = new URL(request.url);
  const file = await readPhotoFile(name, url.searchParams.has("thumb"));
  if (!file) return new Response("Not found", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": "image/jpeg",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  };
  if (url.searchParams.has("download")) headers["Content-Disposition"] = `attachment; filename="${name}.jpg"`;
  return new Response(new Uint8Array(file), { headers });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  if (!(await isAdmin())) return Response.json({ error: "Not logged in." }, { status: 401 });
  const { name } = await params;
  return (await deletePhoto(name))
    ? Response.json({ ok: true })
    : Response.json({ error: "Not found." }, { status: 404 });
}
