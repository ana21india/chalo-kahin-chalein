// Server-side only. Never import this from src/ — the API key must never
// reach the client bundle. This is called from api/explain-options.js
// (Vercel serverless function in prod) and from the Vite dev middleware in
// vite.config.js (local dev), so both paths share one implementation.

const GEMINI_MODEL = 'gemini-3.8-flash'

// Turns the already-computed, deterministic option list (scores, hard
// constraints, per-traveller fit — all real numbers from tripLogic.js) into
// short natural-language explanations. Gemini is never asked to choose or
// score destinations, only to write up facts it's handed — it can't
// introduce a recommendation the constraint engine didn't already approve.
export async function explainOptions({ options, groupSize }, apiKey) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  if (!Array.isArray(options) || options.length === 0) {
    return {}
  }

  const payload = options.map((o) => ({
    name: o.name,
    groupFitScore: o.groupFitScore,
    alignment: o.alignment,
    isWildcard: o.isWildcard,
    strengths: o.strengths,
    whoCompromises: o.whoCompromises,
    whoBlocked: o.whoBlocked,
    compromiseNotes: o.compromiseNotes,
    perTraveller: (o.perTraveller || []).map((t) => ({
      name: t.name,
      points: (t.bullets || []).map((b) => `${b.preference} -> ${b.matches}`),
      blocked: t.blocked,
    })),
    sharedExperiences: (o.sharedExperiences || []).map((s) => s.experience),
    practicalFit: o.practicalFit,
  }))

  const prompt = `You are writing short, warm, honest explanations for a group trip-planning app called "Chalo Kahin Chalein". A deterministic scoring engine has already picked these ${options.length} destination option(s) for a group of ${groupSize} people and computed every fact below. You are NOT choosing or scoring destinations, and you must NEVER invent a fact not present in the data — only write a natural 2-3 sentence explanation of why EACH destination works (or doesn't fully work) for THIS specific group, grounded strictly in the given data. Mention specific people by name where it adds clarity, especially anyone blocked or compromising. Friendly, concise, no marketing fluff, no emoji.

Data:
${JSON.stringify(payload, null, 2)}

Return ONLY a JSON object mapping each destination's exact "name" field to its explanation string, e.g. {"Goa": "...", "Jaipur": "..."}. No other text, no markdown fences.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    }
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini API error ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no text')
  return JSON.parse(text)
}
