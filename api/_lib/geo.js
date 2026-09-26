// Server-side only. Free, no-API-key geocoding (Nominatim/OpenStreetMap) +
// routing (OSRM's public demo server) used to sanity-check an AI-suggested
// destination's distance/time against REAL road data, instead of trusting
// Gemini's own guessed number — this app's own earlier testing showed the
// same precise question asked 5 times gave 5 different confident answers,
// and in production Gemini estimated "Tarkarli" (coastal Maharashtra) at
// 5.5h from Delhi when the real road distance is well over a day.
//
// Road-driving time is used as a rough floor even when the traveller picked
// Flight/Train — there's no free source of real Indian flight/train
// schedules, but a destination that's a two-day drive away isn't a
// "5.5 hour" trip by any mode, so it's still a meaningful sanity check.
//
// Both services are free public community servers meant for light, polite
// use, not heavy production traffic — calls are sequenced with a small
// delay and cached in-memory for this server process's lifetime so a
// single request never hammers either one.

const geocodeCache = new Map()
const routeCache = new Map()

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function geocodeCity(name) {
  if (geocodeCache.has(name)) return geocodeCache.get(name)
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ChaloKahinChalein/1.0 (group trip planning app; distance sanity-check)' } })
    if (!res.ok) { geocodeCache.set(name, null); return null }
    const data = await res.json()
    const result = data?.[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null
    geocodeCache.set(name, result)
    return result
  } catch {
    geocodeCache.set(name, null)
    return null
  }
}

async function routeHours(origin, dest) {
  const key = `${origin.lat},${origin.lon}|${dest.lat},${dest.lon}`
  if (routeCache.has(key)) return routeCache.get(key)
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${dest.lon},${dest.lat}?overview=false`
  try {
    const res = await fetch(url)
    if (!res.ok) { routeCache.set(key, null); return null }
    const data = await res.json()
    const durationSeconds = data?.routes?.[0]?.duration
    const result = typeof durationSeconds === 'number' ? durationSeconds / 3600 : null
    routeCache.set(key, result)
    return result
  } catch {
    routeCache.set(key, null)
    return null
  }
}

// destinations: [{ name }], originCities: [string]
// Returns { [destinationName]: { [originCity]: hoursOrNull } } — null means
// geocoding or routing failed for that pair (unreachable by road, unknown
// place name, or the free service was unavailable), never a guessed number.
export async function verifyDistances(destinations, originCities) {
  const result = {}
  const uniqueCities = [...new Set(originCities.filter(Boolean))]
  const uniqueDestNames = [...new Set(destinations.map((d) => d.name).filter(Boolean))]

  const cityCoords = {}
  for (const city of uniqueCities) {
    cityCoords[city] = await geocodeCity(city)
    await sleep(300)
  }
  const destCoords = {}
  for (const name of uniqueDestNames) {
    destCoords[name] = await geocodeCity(name)
    await sleep(300)
  }

  for (const name of uniqueDestNames) {
    result[name] = {}
    const dCoord = destCoords[name]
    for (const city of uniqueCities) {
      const oCoord = cityCoords[city]
      if (!dCoord || !oCoord) { result[name][city] = null; continue }
      result[name][city] = await routeHours(oCoord, dCoord)
    }
  }
  return result
}
