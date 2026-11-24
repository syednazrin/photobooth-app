import Shell from "@/components/Shell";
import { toPublic } from "@/lib/config";
import { guard } from "@/lib/server/auth";
import { diskUsage, readConfig } from "@/lib/server/storage";

export const metadata = { title: "Disk usage · photobooth" };

function fmt(bytes: number | null) {
  if (bytes === null) return "unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

export default async function DiskUsagePage() {
  await guard("admin", "/admin/diskusage");
  const cfg = toPublic(await readConfig());
  const u = await diskUsage();
  const used = u.photos.total + u.thumbs.total + u.assets.total + u.videos.total;
  const rows: [string, string, string][] = [
    ["Photos", String(u.photos.count), fmt(u.photos.total)],
    ["Videos", String(u.videos.count), fmt(u.videos.total)],
    ["Thumbnails", String(u.thumbs.count), fmt(u.thumbs.total)],
    ["Uploaded assets", String(u.assets.count), fmt(u.assets.total)],
  ];
  const pct = u.totalDisk && u.free !== null ? Math.round(((u.totalDisk - u.free) / u.totalDisk) * 100) : null;

  return (
    <Shell cfg={cfg}>
      <h1 className="text-3xl font-extralight tracking-widest mb-6">Disk usage</h1>
      <table className="w-full max-w-xl text-left">
        <thead>
          <tr className="opacity-60 text-sm"><th className="py-2">What</th><th>Files</th><th>Size</th></tr>
        </thead>
        <tbody>
          {rows.map(([a, b, c]) => (
            <tr key={a} className="border-t border-white/10"><td className="py-2">{a}</td><td>{b}</td><td>{c}</td></tr>
          ))}
          <tr className="border-t border-white/30 font-medium"><td className="py-2">Total used by the booth</td><td /><td>{fmt(used)}</td></tr>
        </tbody>
      </table>
      <p className="mt-6">
        Free space on the disk: <strong>{fmt(u.free)}</strong>
        {u.totalDisk ? ` of ${fmt(u.totalDisk)}` : ""}
        {pct !== null ? ` (${pct}% used)` : ""}
      </p>
      <p className="mt-2 text-sm opacity-60">Data folder: <code>{u.dataDir}</code></p>
    </Shell>
  );
}
