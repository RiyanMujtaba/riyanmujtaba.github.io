# The Diary — a Tom Riddle diary web app

Write to the page by hand (Apple Pencil / finger on iPad). Your ink **absorbs
into the page**, an AI reads your handwriting, and the diary **writes back** in a
handwritten font — like Tom Riddle's diary in Harry Potter.

Talk to it long enough and press it on who it *really* is… and it reveals itself:
**TOM MARVOLO RIDDLE → I AM LORD VOLDEMORT**, the letters flying into place and
burning. 🔥

## Use it
Open on an iPad (best with Apple Pencil). Just write, pause ~3.5s (or it reads
automatically), and the diary replies. No setup for the user — the API key lives
server-side.

- Live: `https://riyanmujtaba.github.io/previews/riddle-diary/`
- Add `?test` to the URL to show a hidden button that previews the reveal
  animation (kept off the shared link so it's not a spoiler).

## How it works
- Handwriting drawn on a `<canvas>` (pressure-aware, palm rejection for Pencil)
- Strokes captured to an image, sent to a **Cloudflare Worker** (`worker.js`)
- The Worker holds the **Gemini API key as a secret** and calls Gemini's vision
  model — so the key is never in the client or the repo
- The diary remembers the conversation, stays in character (menacing young
  Voldemort), and triggers the anagram reveal at the dramatic moment

## Files
- `index.html` — the diary app (single file, vanilla JS)
- `worker.js` — the Cloudflare Worker proxy (paste into a Worker, add secret
  `GEMINI_API_KEY`, deploy)

---
Built by [Riyan Mujtaba](https://riyanmujtaba.github.io)
