// Curated, mode-aware travel-time estimates used to filter destinations by
// real reachability, per the "hard travel constraint eliminates a
// DESTINATION, not the TRIP" architecture (see tripLogic.js).
//
// These are hand-curated approximate real-world durations (flight/train/road,
// grouped by broad origin region), not live routing data — see the note at
// the bottom of this file for the production upgrade path. We deliberately
// return `null` for any city/destination/mode combination we don't have an
// estimate for, rather than guessing, so the engine never hard-blocks a
// destination on a hallucinated number (see estimateTravelHours).

// Region for the 12 hub cities we have curated data for. Satellite/nearby
// cities that are also in the starting-city picker (MAJOR_CITIES) but aren't
// their own hub map to whichever hub they're effectively part of for travel
// purposes (e.g. Noida/Gurugram are NCR, treated as Delhi) — everything else
// left out returns null from regionForCity and the engine never hard-blocks
// or guesses a number for it (see estimateTravelHours).
export const CITY_REGION = {
  Delhi: 'north', Chandigarh: 'north', Lucknow: 'north', Jaipur: 'north',
  Noida: 'north', Gurugram: 'north', Faridabad: 'north', Ghaziabad: 'north',
  Dehradun: 'north', Agra: 'north', Meerut: 'north', Karnal: 'north', Panipat: 'north',
  Mumbai: 'west', Pune: 'west', Ahmedabad: 'west',
  'Navi Mumbai': 'west', Thane: 'west', Nashik: 'west', Surat: 'west', Vadodara: 'west',
  Bengaluru: 'south', Chennai: 'south', Hyderabad: 'south', Kochi: 'south',
  Mysuru: 'south', Coimbatore: 'south', Thiruvananthapuram: 'south', Vijayawada: 'south',
  Kolkata: 'east', Howrah: 'east', Bhubaneswar: 'east', Guwahati: 'east',
}

// Hours by mode, per broad origin region. Missing mode = not a realistic way
// to reach that destination at all (e.g. train to Bali); a present number is
// an approximate typical duration for that mode from that region.
export const TRAVEL_TIMES = {
  Goa: {
    north: { Flight: 2.5, Train: 26, Road: 24 },
    west: { Flight: 1.5, Train: 10, Road: 10 },
    south: { Flight: 1.5, Train: 13, Road: 14 },
    east: { Flight: 2.5, Train: 30, Road: 30 },
  },
  'Bali, Indonesia': {
    north: { Flight: 9 }, west: { Flight: 8 }, south: { Flight: 6.5 }, east: { Flight: 6 },
  },
  'Thailand (Phuket/Bangkok)': {
    north: { Flight: 5 }, west: { Flight: 5.5 }, south: { Flight: 3.5 }, east: { Flight: 2.5 },
  },
  Vietnam: {
    north: { Flight: 6 }, west: { Flight: 7 }, south: { Flight: 5 }, east: { Flight: 3.5 },
  },
  'Sri Lanka': {
    north: { Flight: 4 }, west: { Flight: 3 }, south: { Flight: 1.5 }, east: { Flight: 3 },
  },
  Manali: {
    north: { Flight: 1.25, Road: 10 },
    west: { Flight: 3 },
    south: { Flight: 4 },
    east: { Flight: 4.5 },
  },
  Shimla: {
    north: { Train: 8, Road: 7 },
    west: { Train: 24, Road: 20 },
    south: { Train: 30, Road: 35 },
    east: { Train: 28, Road: 30 },
  },
  Rishikesh: {
    north: { Train: 7, Road: 6 },
    west: { Train: 22, Road: 20 },
    south: { Train: 28, Road: 30 },
    east: { Train: 22, Road: 24 },
  },
  Coorg: {
    south: { Road: 7 }, west: { Road: 14 }, north: { Road: 32 }, east: { Road: 32 },
  },
  'Munnar & Kerala backwaters': {
    south: { Flight: 2, Road: 6 },
    west: { Flight: 2.5, Road: 20 },
    north: { Flight: 3.5, Road: 36 },
    east: { Flight: 3.5, Road: 36 },
  },
  'Andaman Islands': {
    south: { Flight: 2 }, east: { Flight: 2 }, west: { Flight: 3.5 }, north: { Flight: 4 },
  },
  Udaipur: {
    north: { Flight: 1.25, Train: 8, Road: 7 },
    west: { Flight: 1.25, Train: 10, Road: 8 },
    south: { Flight: 2, Train: 24, Road: 22 },
    east: { Flight: 3, Train: 28, Road: 30 },
  },
  Jaipur: {
    north: { Flight: 1, Train: 5, Road: 5 },
    west: { Flight: 1.5, Train: 17, Road: 14 },
    south: { Flight: 2.5, Train: 28, Road: 25 },
    east: { Flight: 3, Train: 26, Road: 28 },
  },
  'Meghalaya (Northeast India)': {
    east: { Flight: 1.5, Road: 12 },
    north: { Flight: 3 },
    west: { Flight: 4 },
    south: { Flight: 4.5 },
  },
  'Dubai, UAE': {
    north: { Flight: 3.5 }, west: { Flight: 3 }, south: { Flight: 4 }, east: { Flight: 6 },
  },
  Singapore: {
    north: { Flight: 5.5 }, west: { Flight: 5 }, south: { Flight: 4 }, east: { Flight: 3 },
  },
  Ladakh: {
    north: { Flight: 1.5, Road: 16 },
    west: { Flight: 3 }, south: { Flight: 4 }, east: { Flight: 4.5 },
  },
  Pondicherry: {
    south: { Train: 6, Road: 6 },
    west: { Train: 24, Road: 20 },
    north: { Train: 34, Road: 35 },
    east: { Train: 26, Road: 25 },
  },
  Hampi: {
    south: { Train: 9, Road: 8 },
    west: { Train: 13, Road: 12 },
    north: { Train: 24, Road: 22 },
    east: { Train: 26, Road: 24 },
  },
  'Kasol & Parvati Valley': {
    north: { Road: 11 }, west: { Road: 26 }, south: { Road: 40 }, east: { Road: 35 },
  },
}

export function regionForCity(city) {
  if (!city) return null
  const key = Object.keys(CITY_REGION).find((c) => c.toLowerCase() === city.trim().toLowerCase())
  return key ? CITY_REGION[key] : null
}

// Returns hours, or null if we have no curated estimate for this
// city/destination/mode — callers must treat null as "unknown", never as 0
// or as an automatic pass/fail.
export function estimateTravelHours(destinationName, originCity, mode) {
  const region = regionForCity(originCity)
  if (!region) return null
  const hours = TRAVEL_TIMES[destinationName]?.[region]?.[mode]
  return typeof hours === 'number' ? hours : null
}

// --- Production upgrade path (not wired up — no backend to hold a key) ---
// To replace this curated table with live data:
//  - Road: Google Maps Distance Matrix API (origin, destination, mode=driving)
//    → real drive duration + distance. Needs a Maps Platform key.
//  - Flight: a flight-schedule/duration API (e.g. Amadeus Flight Offers, or
//    a duration-only source like AviationStack) → actual scheduled duration
//    between nearest airports, not a straight-line guess.
//  - Train (India): no clean public duration API; IRCTC has no open API —
//    would need a licensed data partner (e.g. ixigo/Trainman commercial API)
//    or keep curated estimates for rail.
//  Any of these keys must live server-side (a Vercel serverless function or
//  Supabase Edge Function env var), never in the client bundle — the browser
//  would call our own endpoint, which calls the provider with the key.
