import LoginForm from "@/components/LoginForm";
import Shell from "@/components/Shell";
import { toPublic } from "@/lib/config";
import { usingDefaultPassword } from "@/lib/server/auth";
import { readConfig } from "@/lib/server/storage";

export const metadata = { title: "Log in · photobooth" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Only allow same-site relative redirects.
  const safeNext = next && /^\/(?!\/)[\w\-./]*$/.test(next) ? next : "/admin";
  const cfg = toPublic(await readConfig());
  return (
    <Shell cfg={cfg}>
      <LoginForm next={safeNext} warnDefault={await usingDefaultPassword()} />
    </Shell>
  );
}
