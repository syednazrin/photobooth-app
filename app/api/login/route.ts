import { clientIp, createSession, destroySession, rateLimited, verifyPassword } from "@/lib/server/auth";

export async function POST(request: Request) {
  if (rateLimited(`login:${await clientIp()}`, 8, 10 * 60_000)) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || !(await verifyPassword(password))) {
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  await createSession();
  return Response.json({ ok: true });
}

export async function DELETE() {
  await destroySession();
  return Response.json({ ok: true });
}
