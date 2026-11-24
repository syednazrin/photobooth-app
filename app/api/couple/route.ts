import { createRoom } from "@/lib/server/rooms";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rows = body?.rows === 3 ? 3 : 2;
  return Response.json({ code: await createRoom(rows) });
}
