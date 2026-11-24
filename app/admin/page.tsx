import AdminForm from "@/components/AdminForm";
import Shell from "@/components/Shell";
import { toPublic } from "@/lib/config";
import { guard } from "@/lib/server/auth";
import { readAsset, readConfig } from "@/lib/server/storage";

export const metadata = { title: "Admin · photobooth" };

export default async function AdminPage() {
  await guard("admin", "/admin");
  const cfg = await readConfig();
  return (
    <Shell cfg={toPublic(cfg)}>
      <AdminForm
        initial={{ ...cfg, smtpPass: "" }}
        hasFrame={!!(await readAsset("frame"))}
        hasBackground={!!(await readAsset("background"))}
      />
    </Shell>
  );
}
