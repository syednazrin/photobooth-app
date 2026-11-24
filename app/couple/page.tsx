import Couple from "@/components/Couple";
import Shell from "@/components/Shell";
import { toPublic } from "@/lib/config";
import { readConfig } from "@/lib/server/storage";

export const metadata = { title: "Couples · photobooth" };

export default async function CouplePage() {
  const cfg = toPublic(await readConfig());
  return (
    <Shell cfg={cfg}>
      <Couple cfg={cfg} />
    </Shell>
  );
}
