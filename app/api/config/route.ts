import { sanitizeConfig, toPublic } from "@/lib/config";
import { isAdmin, setPassword } from "@/lib/server/auth";
import { readConfig, writeConfig } from "@/lib/server/storage";

export async function GET() {
  return Response.json(toPublic(await readConfig()), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Not logged in." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Bad request." }, { status: 400 });

  const current = await readConfig();
  const incoming = { ...body } as Record<string, unknown>;
  // The admin form never receives the stored SMTP password; an empty value means "keep it".
  if (!incoming.smtpPass) delete incoming.smtpPass;
  const next = sanitizeConfig(incoming, current);
  await writeConfig(next);

  if (typeof body.newPassword === "string" && body.newPassword) {
    if (body.newPassword.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters (other settings were saved)." }, { status: 400 });
    }
    await setPassword(body.newPassword);
  }
  return Response.json({ ok: true });
}
