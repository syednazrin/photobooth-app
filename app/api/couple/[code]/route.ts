import { decodeDataUrl } from "@/lib/server/storage";
import { isWho, readRoom, saveShot, updateRoom } from "@/lib/server/rooms";

type Ctx = { params: Promise<{ code: string }> };
const noStore = { "Cache-Control": "no-store" };

export async function GET(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const r = await readRoom(code.toUpperCase());
  if (!r) return Response.json({ error: "Room not found. Check the code." }, { status: 404 });
  return Response.json({ ...r, now: Date.now() }, { headers: noStore });
}

export async function POST(request: Request, { params }: Ctx) {
  const code = (await params).code.toUpperCase();
  const body = await request.json().catch(() => null);
  const room = await readRoom(code);
  if (!room) return Response.json({ error: "Room not found. Check the code." }, { status: 404 });

  switch (body?.action) {
    case "join":
      await updateRoom(code, (r) => void (r.joined = true));
      break;
    case "ready": {
      if (!isWho(body.who)) return Response.json({ error: "Bad request." }, { status: 400 });
      const who: "a" | "b" = body.who;
      await updateRoom(code, (r) => {
        r.ready[who] = true;
        if (r.ready.a && r.ready.b && !r.startAt) r.startAt = Date.now() + 5000;
      });
      break;
    }
    case "upload": {
      const i = Number(body.index);
      const buf = decodeDataUrl(body.image, 12 * 1024 * 1024);
      if (!isWho(body.who) || !Number.isInteger(i) || i < 0 || i >= room.rows || !buf) {
        return Response.json({ error: "Bad request." }, { status: 400 });
      }
      const who: "a" | "b" = body.who;
      await saveShot(code, room.round, who, i, buf);
      await updateRoom(code, (r) => void (r.uploaded[who] = Math.max(r.uploaded[who], i + 1)));
      break;
    }
    case "again":
      await updateRoom(code, (r) => {
        if (r.round !== room.round) return; // the other person already started a new round
        r.round += 1;
        r.ready = { a: false, b: false };
        r.startAt = null;
        r.uploaded = { a: 0, b: 0 };
      });
      break;
    default:
      return Response.json({ error: "Bad request." }, { status: 400 });
  }
  return Response.json({ ok: true }, { headers: noStore });
}
