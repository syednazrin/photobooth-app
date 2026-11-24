import GalleryClient from "@/components/GalleryClient";
import Shell from "@/components/Shell";
import { toPublic } from "@/lib/config";
import { guard, isAdmin } from "@/lib/server/auth";
import { listPhotos, readConfig } from "@/lib/server/storage";
import "photoswipe/style.css";

export const metadata = { title: "Gallery · photobooth" };

export default async function GalleryPage() {
  await guard("gallery", "/gallery");
  const cfg = toPublic(await readConfig());
  const photos = (await listPhotos()).map(({ name, width, height, video }) => ({ name, width, height, video }));
  return (
    <Shell cfg={cfg} wide>
      <GalleryClient cfg={cfg} initial={photos} admin={await isAdmin()} />
    </Shell>
  );
}
