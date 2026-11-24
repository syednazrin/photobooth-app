import nodemailer from "nodemailer";
import { clientIp, rateLimited } from "@/lib/server/auth";
import { NAME_RE, readConfig, readPhotoFile } from "@/lib/server/storage";

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

export async function POST(request: Request) {
  const cfg = await readConfig();
  if (!cfg.emailEnabled || !cfg.smtpHost) {
    return Response.json({ error: "Email is not set up." }, { status: 503 });
  }
  if (rateLimited(`email:${await clientIp()}`, 10, 60 * 60_000)) {
    return Response.json({ error: "Too many emails. Try again later." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  const name = typeof body?.name === "string" ? body.name : "";
  if (!EMAIL_RE.test(to) || to.length > 200) return Response.json({ error: "Invalid email address." }, { status: 400 });
  if (!NAME_RE.test(name)) return Response.json({ error: "Invalid photo." }, { status: 400 });
  const photo = await readPhotoFile(name);
  if (!photo) return Response.json({ error: "Photo not found." }, { status: 404 });

  try {
    const transport = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpSecure,
      auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
    });
    await transport.sendMail({
      from: cfg.emailFrom || cfg.smtpUser,
      to,
      subject: cfg.emailSubject,
      text: cfg.emailBody,
      attachments: [{ filename: `${name}.jpg`, content: photo, contentType: "image/jpeg" }],
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("email failed", e);
    return Response.json({ error: "Could not send the email. Check the SMTP settings." }, { status: 502 });
  }
}
