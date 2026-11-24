import Booth from "@/components/Booth";
import Shell from "@/components/Shell";
import { toPublic } from "@/lib/config";
import { guard } from "@/lib/server/auth";
import { readConfig } from "@/lib/server/storage";

export default async function Home() {
  await guard("start", "/");
  const cfg = toPublic(await readConfig());
  return (
    <Shell cfg={cfg}>
      <Booth cfg={cfg} />
    </Shell>
  );
}
