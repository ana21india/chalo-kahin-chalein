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

// Generates a rough, explicitly-labeled profile for a destination OUTSIDE
// the curated catalog, so the engine can score it at all. This is a
// deliberate, bounded exception to "never estimate a precise number" — the
// user asked for an "educated guess" rather than no coverage. The prompt
// forces coarse, rounded values (nearest 0.5h, nearest ₹5,000) instead of
// false precision like "6.37 hours" — a model that doesn't actually know a
// number should round to its best real estimate, never fabricate decimals
// that imply a confidence it doesn't have. Callers must always label this
// data as an unverified AI estimate and never use it to hard-block anyone
// (see tripLogic.js: aiEstimated destinations skip hard travel/budget
// filters entirely) — a wrong guess should degrade gracefully, not exclude
// a destination that was actually fine.
const PROFILE_AXES = ['Beach', 'Mountains', 'City', 'Parks & nature', 'Cultural', 'Adventure', 'Nightlife', 'Romantic']

export async function estimateDestination(name, apiKey) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  if (!name || !name.trim()) throw new Error('No destination name given')

  const prompt = `You are estimating a rough travel profile for "${name}" for an Indian group-trip-planning app, so it can be scored alongside a curated catalog. This is explicitly a coarse educated guess, not verified data — reason briefly from real geography and general knowledge (region, typical distance from major Indian cities, known cost of living), then round aggressively. Never state false precision: travel time to the nearest 0.5 hour, budget to the nearest ₹5,000. If you're not confident of an exact figure, pick your best reasonable rounded estimate rather than refusing or leaving it blank — every field is required.

Return ONLY a JSON object with this exact shape, no other text, no markdown fences:
{
  "profile": { "Beach": 0-1, "Mountains": 0-1, "City": 0-1, "Parks & nature": 0-1, "Cultural": 0-1, "Adventure": 0-1, "Nightlife": 0-1, "Romantic": 0-1 },
  "budgetMin": <INR, whole trip per person, rounded to nearest 5000>,
  "budgetMax": <INR, rounded to nearest 5000>,
  "travelModes": [<subset of "Flight","Train","Road" realistically available from a major Indian hub>],
  "travelTimeHoursFromNorthIndia": <rough hours from Delhi by the fastest listed mode, nearest 0.5>,
  "domestic": <true if in India, else false>,
  "recommendedDuration": { "min": <days>, "max": <days> },
  "typicalPace": <"packed" | "slow" | "either">,
  "suitableStayTypes": [<subset of "hotel","rental">],
  "activities": [<3-5 short activity words>],
  "highlights": { <axis name, only ones scored >= 0.6>: <one short phrase grounded in something real about ${name}> }
}
Axis keys in "profile" and "highlights" must exactly match: ${PROFILE_AXES.join(', ')}.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.15 },
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
  const parsed = JSON.parse(text)

  return {
    name,
    aiEstimated: true,
    profile: parsed.profile,
    highlights: parsed.highlights || {},
    activities: parsed.activities || [],
    budgetMin: parsed.budgetMin,
    budgetMax: parsed.budgetMax,
    travelModes: parsed.travelModes && parsed.travelModes.length ? parsed.travelModes : ['Flight'],
    travelTimeHours: parsed.travelTimeHoursFromNorthIndia ?? 6,
    domestic: Boolean(parsed.domestic),
    recommendedDuration: parsed.recommendedDuration || { min: 3, max: 6 },
    typicalPace: parsed.typicalPace || 'either',
    suitableStayTypes: parsed.suitableStayTypes && parsed.suitableStayTypes.length ? parsed.suitableStayTypes : ['hotel'],
  }
}
