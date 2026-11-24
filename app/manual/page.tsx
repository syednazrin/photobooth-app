import Link from "next/link";
import Doc from "@/components/Doc";
import Shell from "@/components/Shell";
import { toPublic } from "@/lib/config";
import { guard } from "@/lib/server/auth";
import { readConfig } from "@/lib/server/storage";

export const metadata = { title: "Manual · photobooth" };

export default async function ManualPage() {
  await guard("manual", "/manual");
  const cfg = toPublic(await readConfig());
  return (
    <Shell cfg={cfg}>
      <Doc>
        <h1>Manual</h1>
        <p>
          Every setting lives in the <Link href="/admin">admin panel</Link>. Changes apply the next time the booth page is loaded.
          See also the <Link href="/manual/faq">FAQ</Link>.
        </p>

        <h2>Pages</h2>
        <ul>
          <li><code>/</code> the booth: live camera, countdown, photos, filter choice, save.</li>
          <li><code>/gallery</code> all saved pictures (PhotoSwipe viewer with download, QR/email, print and, for admins, delete).</li>
          <li><code>/slideshow</code> a full-screen loop of the saved pictures. Press F for fullscreen. New pictures appear automatically.</li>
          <li><code>/effects</code> the standalone fog and anime window effects.</li>
          <li><code>/admin</code> settings. <code>/admin/diskusage</code> storage overview. <code>/login</code> sign in.</li>
        </ul>

        <h2>General</h2>
        <ul>
          <li><b>Language</b>: booth, gallery and login screens. The admin panel and manual are English only.</li>
          <li><b>Event line</b>: text and symbol (for example a heart) shown above the camera on the start screen.</li>
          <li><b>Public URL</b>: the address put into QR codes. <code>localhost</code> only works on this computer. Enter the computer&apos;s network address, such as <code>http://192.168.1.20:3000</code>, so guests&apos; phones can download their picture.</li>
          <li><b>File names</b>: date and time, or random.</li>
        </ul>

        <h2>Capture</h2>
        <ul>
          <li><b>Layout</b>: single photo, vertical strip (4), 2×2 grid (4), row of 3, or one large + two small. The layout decides how many photos are taken.</li>
          <li><b>Countdown / pause</b>: seconds before each photo and between photos.</li>
          <li><b>Wait for a tap</b>: the booth pauses after each photo until the guest taps the button or presses the take-photo key (a collage with interruption).</li>
          <li><b>Take-photo key</b>: a keyboard key code (<code>Space</code>, <code>Enter</code>, <code>KeyB</code>…). Handy for a wired button that acts as a keyboard.</li>
        </ul>

        <h2>Filters</h2>
        <p>
          Pick which filters guests can choose from after the photos are taken. <b>anime</b> uses an AI model in the browser
          (downloaded once, a few seconds per photo). With &quot;let guests choose&quot; off, the default filter is applied and the
          picture is saved immediately.
        </p>

        <h2>Picture look</h2>
        <ul>
          <li><b>Polaroid effect</b>: white card with a caption. In collages the cards are tilted slightly.</li>
          <li><b>Frame</b>: a colour border, or a PNG image laid over the whole picture (use a transparent middle).</li>
          <li><b>Text under the picture</b>: supports <code>{"{date}"}</code>, <code>{"{time}"}</code> and <code>{"{event}"}</code>.</li>
          <li><b>QR on picture</b>: adds a column on the right with a QR code to download that picture.</li>
        </ul>

        <h2>Chroma keying</h2>
        <p>
          Replace a green (or other solid colour) backdrop with a colour or an uploaded image. Set the key colour to your backdrop,
          then raise <b>tolerance</b> until the backdrop disappears and use <b>softness</b> to smooth the edges. Even lighting on the backdrop matters most.
        </p>

        <h2>Printing</h2>
        <p>
          The print button opens the browser print dialog with the picture sized to the chosen paper. For printing without a
          dialog, start Chrome in kiosk-printing mode: <code>chrome --kiosk --kiosk-printing http://localhost:3000</code>.
          Auto-print waits the chosen delay after saving; the print key triggers a print on the result screen.
        </p>

        <h2>Email</h2>
        <p>
          Enter your SMTP server details. The picture is attached to the email. Each visitor address is limited to 10 emails per hour.
        </p>

        <h2>Access</h2>
        <p>
          The admin panel is always password protected. You can also protect the booth, gallery/slideshow and the manual.
          The first-run password is <code>photobooth</code>: change it right away in the admin panel, or set the
          <code> ADMIN_PASSWORD</code> environment variable.
        </p>

        <h2>Where things are stored</h2>
        <p>
          Everything is kept in the <code>data</code> folder next to the app (or the folder in <code>PHOTOBOOTH_DATA</code>):
          <code> photos/</code>, <code>thumbs/</code>, <code>assets/</code> and <code>config.json</code>. Back up that folder to keep your pictures and settings.
        </p>
      </Doc>
    </Shell>
  );
}
