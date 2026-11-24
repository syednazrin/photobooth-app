import Link from "next/link";
import Doc from "@/components/Doc";
import Shell from "@/components/Shell";
import { toPublic } from "@/lib/config";
import { guard } from "@/lib/server/auth";
import { readConfig } from "@/lib/server/storage";

export const metadata = { title: "FAQ · photobooth" };

const faq: [string, React.ReactNode][] = [
  ["The camera does not start.", <>Browsers only allow camera access on <code>https</code> or <code>localhost</code>. Allow the camera for the page, close other apps that use it, then reload. Over a local network use https (for example through a tunnel or a reverse proxy).</>],
  ["The QR code does not work on a phone.", <>The QR code uses the <b>Public URL</b> from the admin panel, or the address in the browser if empty. <code>localhost</code> means &quot;this device&quot; on the phone. Enter the computer&apos;s network address, and make sure the phone is on the same network and the firewall allows the port.</>],
  ["I forgot the admin password.", <>Stop the app, delete <code>data/auth.json</code>, and start it again. The password becomes <code>photobooth</code> (or the <code>ADMIN_PASSWORD</code> value). Change it straight away.</>],
  ["The anime filter is slow or fails.", <>The first use downloads the AI engine and an 8&nbsp;MB model, and needs internet access for the engine files. After that each photo takes a few seconds. If it fails, the original picture is shown.</>],
  ["Can I use a DSLR or a Raspberry Pi button?", <>Not directly from the browser. A USB webcam or a camera that appears as a webcam works. A wired or GPIO button that sends a keyboard key can trigger photos through the take-photo key setting.</>],
  ["Printing opens a dialog every time.", <>That is a browser rule. Start Chrome with <code>--kiosk-printing</code> to print straight to the default printer.</>],
  ["Where are my pictures?", <>In <code>data/photos</code>. The disk usage page in the admin panel shows how much space they take.</>],
  ["Email says it could not send.", <>Check host, port, TLS setting, user and password. Many providers need an app password. Port 587 usually uses TLS off here (STARTTLS), port 465 needs TLS on.</>],
  ["The fog and anime effects.", <>They are standalone pages under <Link href="/effects">Effects</Link>. They need camera access, and fog also uses the microphone and downloads hand-tracking files.</>],
];

export default async function FaqPage() {
  await guard("manual", "/manual/faq");
  const cfg = toPublic(await readConfig());
  return (
    <Shell cfg={cfg}>
      <Doc>
        <h1>FAQ</h1>
        <p><Link href="/manual">← Manual</Link></p>
        <dl>
          {faq.map(([q, a]) => (
            <div key={q}>
              <dt>{q}</dt>
              <dd>{a}</dd>
            </div>
          ))}
        </dl>
      </Doc>
    </Shell>
  );
}
