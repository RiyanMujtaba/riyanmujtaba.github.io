// The Diary — Cloudflare Worker proxy
// Holds the Gemini API key as a SECRET (never in the client, never in the repo).
// The diary app sends the handwriting image (+ prompt); the Worker calls Gemini.
//
// Setup: create a Worker, paste this, add a secret named GEMINI_API_KEY, deploy.

const DEFAULT_SYSTEM = "You are the enchanted diary of Tom Marvolo Riddle (Harry Potter). Someone writes to you by hand; you write back on the page. Voice: mysterious, composed, quietly charming with something cold beneath. Be CONCISE — usually a single short sentence. Only write more when the message truly calls for it, never more than three sentences. Read the handwriting in the image and answer it directly. Never mention being an AI or break character. Output ONLY the reply — no quotes, no narration.";
const USERTEXT = "This is what I just wrote to you on the page:";

const ALLOWED = [
  "https://riyanmujtaba.github.io",
  "http://localhost:8000",
  "null" // opening the local index.html file
];

let MODEL = null; // cached across requests on this isolate (saves a round-trip)

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, cors);
    if (!ALLOWED.includes(origin)) return json({ error: "forbidden origin" }, 403, cors);

    try {
      const body = await request.json();
      const image = body.image;
      if (!image) return json({ error: "no image" }, 400, cors);
      const system = (body.prompt && String(body.prompt).slice(0, 4000)) || DEFAULT_SYSTEM;
      const maxTokens = Math.min(Math.max(parseInt(body.maxTokens) || 140, 40), 400);
      const key = env.GEMINI_API_KEY;
      if (!key) return json({ error: "server key not set" }, 500, cors);

      const model = await pickModel(key);
      const reply = await ask(model, key, image, system, maxTokens);
      return json({ reply }, 200, cors);
    } catch (e) {
      return json({ error: (e && e.message) || "failed" }, 500, cors);
    }
  }
};

function corsHeaders(origin) {
  const allow = ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}
function json(obj, status, cors) { return new Response(JSON.stringify(obj), { status, headers: cors }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function pickModel(key) {
  if (MODEL) return MODEL;
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(key));
  if (!res.ok) throw new Error("model list failed");
  const data = await res.json();
  const usable = (data.models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent"));
  const flash = usable.filter(m => /flash/i.test(m.name) && !/lite|embedding|thinking|exp|vision|tts|image-generation/i.test(m.name));
  const pool = flash.length ? flash : usable.filter(m => !/embedding|tts|image-generation/i.test(m.name));
  if (!pool.length) throw new Error("no usable model");
  const ver = n => { const m = (n || "").match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
  pool.sort((a, b) => ver(b.name) - ver(a.name));
  MODEL = pool[0].name.replace(/^models\//, "");
  return MODEL;
}

async function ask(model, key, b64, system, maxTokens) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key);
  const payload = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: USERTEXT }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
    generationConfig: { temperature: 0.85, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } }
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      const j = await res.json();
      const c = j.candidates && j.candidates[0] && j.candidates[0].content &&
        j.candidates[0].content.parts && j.candidates[0].content.parts.map(p => p.text || "").join("");
      if (c) return c.trim().replace(/^["']|["']$/g, "");
      if (attempt < 2) { await sleep(400); continue; }
      throw new Error("empty reply");
    }
    const status = res.status;
    if ((status === 503 || status === 429 || status >= 500) && attempt < 2) { await sleep(600 * (attempt + 1)); continue; }
    throw new Error("gemini error " + status);
  }
  throw new Error("gemini unavailable");
}
