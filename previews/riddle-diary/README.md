# The Diary — a Tom Riddle diary web app

Write to the page by hand (Apple Pencil / finger on iPad). Your ink **absorbs
into the page**, an AI vision model *reads* your handwriting, and the diary
**writes back** in a handwritten font, letter by letter — like Tom Riddle's
diary in Harry Potter.

## Use it
Open on an iPad (best with Apple Pencil). Tap the ⚙ and paste a free
[Groq API key](https://console.groq.com/keys) (stored only on your device).
Then just write — pause, or tap ✦, and the diary reads and replies.

## How it works
- Handwriting drawn on a `<canvas>` (pressure-aware, palm rejection for Pencil)
- The strokes are captured to an image and sent to a Groq vision model
- The diary's reply is typed out in the Caveat handwriting font

Single-file `index.html`, no build step. Vanilla JS.

---
Built by [Riyan Mujtaba](https://riyanmujtaba.github.io)
