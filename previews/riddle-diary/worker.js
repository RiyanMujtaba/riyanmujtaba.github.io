// The Diary — Cloudflare Worker proxy
// Holds the Gemini API key as a SECRET (never in the client, never in the repo).
// The diary app calls this Worker; the Worker calls Gemini and returns the reply.
//
// Setup (see instructions): create a Worker, paste this, add a secret named
// GEMINI_API_KEY, deploy. Then the diary app just calls this Worker URL —
// no key needed by you or your friends.

const SYSTEM = "You are the enchanted diary of Tom Marvolo Riddle, from Harry Potter. Someone writes to you by hand and you write back on the page. Stay fully in character: charming, articulate, curious, quietly persuasive with something cold beneath the politeness. Never mention being an AI, a model, or a program, and never break character. Read the handwritten message in the image and reply directly and personally to what it says. Keep it short — 1 to 3 sentences, as if penned by hand. Output ONLY your reply: no quotation marks, no narration, no stage directions.";
const USERTEXT = "This is what I just wrote to you on the page:";

// Only these origins may use the Worker (stops randos from draining your quota).
const ALLOWED = [
  "https://riyanmujtaba.github.io",
  "http://localhost:8000",
  "null" // allows opening the local index.html file for testing
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, cors);
    if (!ALLOWED.includes(origin)) return json({ error: "forbidden origin" }, 403, cors);

    try {
      const { image } = await request.json();
      if (!image) return json({ error: "no image" }, 400, cors);
      const key = env.GEMINI_API_KEY;
      if (!key) return json({ error: "server key not set" }, 500, cors);

      const model = await pickModel(key);
      const reply = await ask(model, key, image);
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

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: cors });
}

// Ask Google which models this key can use; pick the best vision-capable flash one.
async function pickModel(key) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(key));
  if (!res.ok) throw new Error("model list failed");
  const data = await res.json();
  const usable = (data.models || []).filter(m => (m.supportedGenerationMethods || []).includes("generateContent"));
  const flash = usable.filter(m => /flash/i.test(m.name) && !/lite|embedding|thinking|exp|vision|tts|image-generation/i.test(m.name));
  const pool = flash.length ? flash : usable.filter(m => !/embedding|tts|image-generation/i.test(m.name));
  if (!pool.length) throw new Error("no usable model");
  const ver = n => { const m = (n || "").match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
  pool.sort((a, b) => ver(b.name) - ver(a.name));
  return pool[0].name.replace(/^models\//, "");
}

async function ask(model, key, b64) {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: USERTEXT }, { inline_data: { mime_type: "image/jpeg", data: b64 } }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 220 }
      })
    }
  );
  if (!res.ok) throw new Error("gemini error " + res.status);
  const j = await res.json();
  const c = j.candidates && j.candidates[0] && j.candidates[0].content &&
    j.candidates[0].content.parts && j.candidates[0].content.parts.map(p => p.text || "").join("");
  if (!c) throw new Error("empty reply");
  return c.trim().replace(/^["']|["']$/g, "");
}
