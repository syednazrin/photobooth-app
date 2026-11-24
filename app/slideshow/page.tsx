import Shell from "@/components/Shell";
import Slideshow from "@/components/Slideshow";
import { toPublic } from "@/lib/config";
import { guard } from "@/lib/server/auth";
import { listPhotos, readConfig } from "@/lib/server/storage";

export const metadata = { title: "Slideshow · photobooth" };

export default async function SlideshowPage() {
  await guard("gallery", "/slideshow");
  const cfg = toPublic(await readConfig());
  const photos = (await listPhotos()).map(({ name }) => ({ name }));
  return (
    <Shell cfg={cfg} nav={false} wide>
      <Slideshow seconds={cfg.slideshowSeconds} initial={photos} />
    </Shell>
  );
}
