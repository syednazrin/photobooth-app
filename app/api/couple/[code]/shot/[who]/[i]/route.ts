import { isWho, readRoom, readShot } from "@/lib/server/rooms";

type Ctx = { params: Promise<{ code: string; who: string; i: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const { code, who, i } = await params;
  const c = code.toUpperCase();
  const room = await readRoom(c);
  const n = Number(i);
  if (!room || !isWho(who) || !Number.isInteger(n)) return new Response("Not found", { status: 404 });
  const round = Number(new URL(request.url).searchParams.get("round")) || room.round;
  const buf = await readShot(c, round, who, n);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
