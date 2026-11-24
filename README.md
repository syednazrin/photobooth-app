# Photobooth (Next.js)

A webcam photobooth rebuilt in Next.js, inspired by [PhotoboothProject/photobooth](https://github.com/PhotoboothProject/photobooth).

## Run

```bash
npm install
npm run dev            # http://localhost:3000
# or for a kiosk:
npm run build && npm start
```

Camera access needs `localhost` or https. If you serve it over plain http with `npm start`, set `INSECURE_COOKIES=1`
so the admin login cookie is accepted.

Admin: <http://localhost:3000/admin>. First-run password is `photobooth`: change it in the admin panel, or set
`ADMIN_PASSWORD` before starting.

## Pages

| Page | What |
|---|---|
| `/` | Booth: live preview, countdown, collage, filter choice, save, QR / download / print / email |
| `/gallery` | PhotoSwipe v5 gallery (▶ opens the video of video strips) (download, QR/email, print, delete for admins) |
| `/slideshow` | Full-screen slideshow (F = fullscreen) |
| `/effects` | Standalone fog and anime-window effects (from the original project) |
| `/admin`, `/admin/diskusage` | Settings, storage overview |
| `/manual`, `/manual/faq` | Offline manual and FAQ |
| `/login` | Sign in |

## Features

Layouts (single, strip, 2x2, row of 3, 1+2), 12 strip colours (maroon, black, cream, blush, ...) plus a custom picker, six photo border styles with colours (chosen by guests after shooting, or set as defaults in admin), Polaroid effect, colour or image frames, text and QR on the picture,
filters incl. an in-browser anime (AnimeGANv2) filter, chroma keying with colour or image background, auto-print and
print key, email via SMTP, login protection for admin / booth / gallery / manual, languages (en, ms, de, es),
date or random file names, event line with symbol, style colours.

Video mode: each shot is a short clip (default 3 s, set in admin). The clips play together in the same strip (colours, borders, footer) and are saved as one MP4 (WebM where the browser cannot do MP4), with a still frame used for the gallery, print and email. The anime filter is photo-only.

Not possible in a browser app: gphoto2/DSLR control and GPIO/rotary hardware buttons. A wired button that sends a
keyboard key can trigger photos through the "take-photo key" setting.

## Data

Everything is stored in `./data` (override with `PHOTOBOOTH_DATA`): `photos/`, `thumbs/`, `videos/`, `assets/`, `config.json`,
`auth.json`. Back this folder up. It is git-ignored.

## Notes

- The anime filter loads onnxruntime-web from jsdelivr (needs internet); the model is `public/models/`.
- Printing uses the browser print dialog. Use `chrome --kiosk --kiosk-printing` for one-tap printing.
- QR codes use the "Public URL" setting. Put your computer's LAN address there so phones can download pictures.
