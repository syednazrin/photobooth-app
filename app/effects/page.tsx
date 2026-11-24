import type { CSSProperties } from "react";
import Reveal from "@/components/Reveal";
import Shell from "@/components/Shell";
import { toPublic } from "@/lib/config";
import { readConfig } from "@/lib/server/storage";
import "./landing.css";

export const metadata = { title: "Effects · photobooth" };

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export default async function EffectsPage() {
  const cfg = toPublic(await readConfig());
  return (
    <Shell cfg={cfg} wide>
      <Reveal className="lp">
        <header className="hero">
          <div className="mid">
            <div className="intro rv" style={d(120)}>
              <p className="lead">
                Two camera filters you play with your hands. Pick one, press start, and your webcam does the rest.
              </p>
              <a className="btn" href="/effects/fog.html">Try fog first</a>
            </div>
            <div className="doors">
              <a className="door rv" style={d(200)} href="/effects/fog.html">
                <div>
                  <h2>Fog</h2>
                  <p>A fogged-up bathroom mirror. Breathe on it, draw in it, wipe it clear.</p>
                </div>
                <span className="arrow" aria-hidden="true">&rarr;</span>
              </a>
              <a className="door rv" style={d(280)} href="/effects/anime-window.html">
                <div>
                  <h2>Anime window</h2>
                  <p>Frame the world with both hands and watch it turn into a painted animation.</p>
                </div>
                <span className="arrow" aria-hidden="true">&rarr;</span>
              </a>
            </div>
          </div>
          <h1 className="name" aria-label="photobooth">
            <span className="rv" style={d(60)}>photo</span>
            <span className="rv" style={d(140)}>booth</span>
          </h1>
        </header>

        <section className="how" id="how" aria-labelledby="how-h">
          <h2 id="how-h" className="rv">How it works</h2>
          <div className="steps">
            <div className="rv">
              <p>
                <strong>To begin,</strong> choose Fog or Anime window and press Start camera. Your browser asks for the
                camera once. Fog also listens through the microphone to feel your breath; say no and hold Space instead.
              </p>
              <ul className="gestures">
                <li><b>Breathe</b><span>on the screen, or hold Space, to fog the glass</span></li>
                <li><b>Pinch</b><span>thumb to index finger to draw in the fog</span></li>
                <li><b>Fist</b><span>wipe the fog away</span></li>
              </ul>
            </div>
            <div className="rv">
              <p>
                <strong>Then,</strong> play. In Fog the glass clouds over, you draw and wipe with your hand. In Anime
                window you hold both hands up like a camera frame, thumbs and index fingers out, and whatever sits
                inside the frame becomes a painted scene.
              </p>
              <div className="frag-row">
                <label className="slider">
                  <span>Brush</span>
                  <input type="range" min="7" max="38" defaultValue="20" tabIndex={-1} aria-label="Brush size example" />
                </label>
                <span className="tool">Clear</span>
                <span className="tool">Tips</span>
                <span className="btn" aria-hidden="true">Save photo</span>
              </div>
            </div>
            <div className="rv">
              <p>
                <strong>When it looks right,</strong> press Save photo. A PNG downloads straight from your browser.
                Nothing is uploaded. To leave, press Back or Esc.
              </p>
              <div className="file"><span>fog-2026-11-24-10-12.png</span><span>Saved</span></div>
            </div>
          </div>
        </section>

        <footer className="close" id="privacy">
          <div className="top">
            <h2 className="rv">Pick a filter.<br />Make a picture.</h2>
            <div className="go rv" style={d(100)}>
              <a className="btn" href="/effects/fog.html">Start with fog</a>
            </div>
            <nav className="links rv" style={d(160)} aria-label="Filters">
              <a href="/effects/fog.html">Fog</a>
              <a href="/effects/anime-window.html">Anime window</a>
              <a href="#how">How it works</a>
            </nav>
          </div>
          <div className="credits">
            <span>Everything runs in your browser. No frames, audio or data leave this machine.</span>
            <span>Hand tracking by MediaPipe. Ghibli look from AnimeGAN (Hayao style).</span>
          </div>
          <div className="big" aria-hidden="true">photobooth</div>
        </footer>
      </Reveal>
    </Shell>
  );
}
