import { DESTINATIONS } from './destinations'

export const NO_PREFERENCE = '__NO_PREFERENCE__'

export function isCompleted(response) {
  return response?.status === 'completed'
}

export function completionCounts(participants, responsesByParticipant) {
  const total = participants.length
  let completed = 0
  let inProgress = 0
  for (const p of participants) {
    const r = responsesByParticipant[p.id]
    if (isCompleted(r)) completed += 1
    else if (r && r.status === 'in_progress') inProgress += 1
  }
  return { total, completed, inProgress, notStarted: total - completed - inProgress }
}

function completedResponses(participants, responsesByParticipant) {
  return participants
    .filter((p) => isCompleted(responsesByParticipant[p.id]))
    .map((p) => ({ participant: p, response: responsesByParticipant[p.id] }))
}

// Consensus for a Top-3 phase: only counts people who expressed an actual
// preference. "No preference" participants are excluded from the denominator
// entirely — they are never treated as votes against an option.
export function groupConsensus(participants, responsesByParticipant, field, noPrefField) {
  const entries = completedResponses(participants, responsesByParticipant)
  const expressed = entries.filter(({ response }) => !response[noPrefField])
  const counts = {}
  for (const { response } of expressed) {
    const values = Array.isArray(response[field]) ? response[field] : []
    for (const v of values) {
      counts[v] = (counts[v] || 0) + 1
    }
  }
  const denom = expressed.length
  return Object.entries(counts)
    .map(([option, count]) => ({ option, count, total: denom }))
    .sort((a, b) => b.count - a.count)
}

function travelTimeMaxHours(value) {
  switch (value) {
    case 'under_3h': return 3
    case 'under_6h': return 6
    case 'under_12h': return 12
    default: return Infinity
  }
}

// Surfaces meaningful group splits rather than hiding them inside one score.
export function computeConflicts(participants, responsesByParticipant) {
  const entries = completedResponses(participants, responsesByParticipant)
  const conflicts = []

  // Budget conflict: hard-limit participants vs. everyone comfortable higher.
  const hardLimiters = entries.filter(({ response }) => response.budget_hard_limit && response.budget_ceiling)
  const flexible = entries.filter(({ response }) => !response.budget_hard_limit || !response.budget_ceiling)
  if (hardLimiters.length > 0 && flexible.length > 0) {
    const lowestCeiling = Math.min(...hardLimiters.map(({ response }) => response.budget_ceiling))
    const higherComfort = flexible.filter(({ response }) => (response.budget_max || 0) > lowestCeiling)
    if (higherComfort.length > 0) {
      conflicts.push({
        type: 'budget',
        title: 'Budget split',
        description: `${higherComfort.length} ${higherComfort.length === 1 ? 'person is' : 'people are'} comfortable spending above ₹${lowestCeiling.toLocaleString('en-IN')}, but ${hardLimiters.length} ${hardLimiters.length === 1 ? 'person has' : 'people have'} a hard maximum around ₹${lowestCeiling.toLocaleString('en-IN')}.`,
        groups: [
          { label: `Comfortable higher`, people: higherComfort.map(({ participant }) => participant.name) },
          { label: `Hard maximum ~₹${lowestCeiling.toLocaleString('en-IN')}`, people: hardLimiters.map(({ participant }) => participant.name) },
        ],
      })
    }
  }

  // Pace conflict: relaxed/slow vs packed/adventure-heavy in vibe picks.
  const relaxedPace = entries.filter(({ response }) => !response.vibes_no_pref && (response.vibes || []).some((v) => ['Relaxed', 'Slow'].includes(v)))
  const packedPace = entries.filter(({ response }) => !response.vibes_no_pref && (response.vibes || []).some((v) => ['Packed', 'Adventure-heavy'].includes(v)))
  const packedOnly = packedPace.filter(({ participant }) => !relaxedPace.some(({ participant: p2 }) => p2.id === participant.id))
  const relaxedOnly = relaxedPace.filter(({ participant }) => !packedPace.some(({ participant: p2 }) => p2.id === participant.id))
  if (packedOnly.length > 0 && relaxedOnly.length > 0) {
    conflicts.push({
      type: 'pace',
      title: 'Pace split',
      description: `${relaxedOnly.length} ${relaxedOnly.length === 1 ? 'person wants' : 'people want'} a relaxed trip, while ${packedOnly.length} ${packedOnly.length === 1 ? 'person wants' : 'people want'} a packed / adventure-heavy itinerary.`,
      groups: [
        { label: 'Relaxed / slow', people: relaxedOnly.map(({ participant }) => participant.name) },
        { label: 'Packed / adventure-heavy', people: packedOnly.map(({ participant }) => participant.name) },
      ],
    })
  }

  // Destination-type conflict: beach vs mountains being the classic split.
  const beachLovers = entries.filter(({ response }) => !response.destination_no_pref && (response.destination_types || []).includes('Beach'))
  const mountainLovers = entries.filter(({ response }) => !response.destination_no_pref && (response.destination_types || []).includes('Mountains'))
  const beachOnly = beachLovers.filter(({ participant }) => !mountainLovers.some(({ participant: p2 }) => p2.id === participant.id))
  const mountainOnly = mountainLovers.filter(({ participant }) => !beachLovers.some(({ participant: p2 }) => p2.id === participant.id))
  if (beachOnly.length > 0 && mountainOnly.length > 0) {
    conflicts.push({
      type: 'destination',
      title: 'Destination-type split',
      description: `${beachOnly.length} ${beachOnly.length === 1 ? 'person wants' : 'people want'} beaches, ${mountainOnly.length} ${mountainOnly.length === 1 ? 'person prefers' : 'people prefer'} mountains.`,
      groups: [
        { label: 'Beach', people: beachOnly.map(({ participant }) => participant.name) },
        { label: 'Mountains', people: mountainOnly.map(({ participant }) => participant.name) },
      ],
    })
  }

  // Nightlife conflict: some want it, some have it as a dealbreaker.
  const wantsNightlife = entries.filter(({ response }) => (response.activities || []).includes('Nightlife') || (response.vibes || []).includes('Party-focused'))
  const avoidsNightlife = entries.filter(({ response }) => (response.dealbreakers || []).includes('Too much nightlife'))
  if (wantsNightlife.length > 0 && avoidsNightlife.length > 0) {
    conflicts.push({
      type: 'nightlife',
      title: 'Nightlife split',
      description: `${wantsNightlife.length} ${wantsNightlife.length === 1 ? 'person wants' : 'people want'} nightlife, but ${avoidsNightlife.length} ${avoidsNightlife.length === 1 ? 'person has' : 'people have'} flagged too much nightlife as a dealbreaker.`,
      groups: [
        { label: 'Wants nightlife', people: wantsNightlife.map(({ participant }) => participant.name) },
        { label: 'Dealbreaker: too much nightlife', people: avoidsNightlife.map(({ participant }) => participant.name) },
      ],
    })
  }

  return conflicts
}

function overlapScore(a = [], b = []) {
  if (!a.length || !b.length) return 0
  const setB = new Set(b)
  const hits = a.filter((x) => setB.has(x)).length
  return hits / a.length
}

// Evaluates how a single destination fits one participant's response,
// treating deal-breakers and a hard budget limit as constraints that a
// majority preference cannot simply override.
export function fitForDestination(destination, response) {
  const reasons = []
  let level = 'green'
  let score = 0

  if (!response.destination_no_pref) {
    const s = overlapScore(response.destination_types, destination.types)
    score += s * 3
    if (s > 0) reasons.push({ ok: true, text: `Matches your destination-type preference` })
  }

  if (response.trip_scope === 'international') {
    if (!destination.domestic) {
      score += 2
      reasons.push({ ok: true, text: 'This is the international trip you wanted' })
    } else {
      reasons.push({ ok: 'warn', text: 'You wanted international — this one is domestic' })
    }
  } else if (response.trip_scope === 'national') {
    if (destination.domestic) {
      score += 2
      reasons.push({ ok: true, text: 'This is the domestic (within-India) trip you wanted' })
    } else {
      reasons.push({ ok: 'warn', text: 'You wanted a domestic trip — this one is international' })
    }
  }
  if (!response.activities_no_pref) {
    const s = overlapScore(response.activities, destination.activities)
    score += s * 3
    if (s > 0) reasons.push({ ok: true, text: `Good overlap on activities` })
  }
  if (!response.vibes_no_pref) {
    const s = overlapScore(response.vibes, destination.vibes)
    score += s * 2
    if (s > 0) reasons.push({ ok: true, text: `Matches the trip vibe you want` })
  }
  if (!response.no_specific_destination && (response.specific_destinations || []).some((d) => d.toLowerCase().includes(destination.name.split(',')[0].toLowerCase()))) {
    score += 5
    reasons.push({ ok: true, text: 'This is a place you specifically asked for' })
  }

  // Budget — hard constraint if the participant marked a hard limit.
  const ceiling = response.budget_ceiling || response.budget_max
  if (ceiling) {
    if (destination.budgetMin > ceiling) {
      if (response.budget_hard_limit) {
        level = 'red'
        reasons.push({ ok: false, text: `Exceeds your hard budget limit (₹${ceiling.toLocaleString('en-IN')})` })
      } else {
        if (level !== 'red') level = 'yellow'
        reasons.push({ ok: 'warn', text: `Above your comfortable budget, though not a hard limit` })
      }
    } else if (response.budget_max && destination.budgetMax > response.budget_max) {
      if (level !== 'red') level = 'yellow'
      reasons.push({ ok: 'warn', text: `Slightly above your comfortable budget range` })
    } else {
      reasons.push({ ok: true, text: 'Budget works' })
      score += 2
    }
  }

  // Travel time
  const maxHours = travelTimeMaxHours(response.travel_time_max)
  if (destination.travelTimeHours > maxHours) {
    if (level !== 'red') level = 'yellow'
    reasons.push({ ok: 'warn', text: 'Longer travel than you said you prefer' })
  }

  // Deal-breakers — always hard constraints.
  const dbs = response.no_dealbreakers ? [] : (response.dealbreakers || [])
  for (const db of dbs) {
    if (db === 'Exceeds my budget' && ceiling && destination.budgetMin > ceiling) {
      level = 'red'
      reasons.push({ ok: false, text: 'Dealbreaker: exceeds your budget' })
    }
    if (db === 'Too much travel' && destination.travelTimeHours > 8) {
      level = 'red'
      reasons.push({ ok: false, text: 'Dealbreaker: too much travel' })
    }
    if (db === 'Too much nightlife' && (destination.vibes.includes('Party-focused') || destination.activities.includes('Nightlife'))) {
      level = 'red'
      reasons.push({ ok: false, text: 'Dealbreaker: too much nightlife' })
    }
    if (db === 'Too little nightlife' && !destination.activities.includes('Nightlife')) {
      if (level !== 'red') level = 'yellow'
      reasons.push({ ok: 'warn', text: "Not much nightlife here — you wanted some" })
    }
    if (db === 'Too much trekking' && destination.activities.includes('Trekking') && destination.vibes.includes('Adventure-heavy')) {
      level = 'red'
      reasons.push({ ok: false, text: 'Dealbreaker: too much trekking' })
    }
    if (db === 'Too hectic' && destination.vibes.includes('Packed')) {
      level = 'red'
      reasons.push({ ok: false, text: 'Dealbreaker: too hectic' })
    }
    if (db === 'Too relaxed' && destination.vibes.length && destination.vibes.every((v) => ['Relaxed', 'Slow'].includes(v))) {
      level = 'red'
      reasons.push({ ok: false, text: 'Dealbreaker: too relaxed for you' })
    }
    if (db === 'International travel' && !destination.domestic) {
      level = 'red'
      reasons.push({ ok: false, text: "Dealbreaker: it's international travel" })
    }
    if (db === 'Domestic travel' && destination.domestic) {
      level = 'red'
      reasons.push({ ok: false, text: "Dealbreaker: it's domestic travel" })
    }
  }

  if (reasons.length === 0) reasons.push({ ok: 'warn', text: 'No strong signal either way' })
  return { level, score, reasons }
}

// Produces 2-3 viable options with group + person-level analysis.
export function generateOptions(participants, responsesByParticipant, maxOptions = 3) {
  const entries = completedResponses(participants, responsesByParticipant)
  if (entries.length === 0) return []

  const scored = DESTINATIONS.map((destination) => {
    const fits = entries.map(({ participant, response }) => ({
      participant,
      ...fitForDestination(destination, response),
    }))
    const groupScore = fits.reduce((sum, f) => sum + f.score, 0) / fits.length
    const reds = fits.filter((f) => f.level === 'red').length
    const yellows = fits.filter((f) => f.level === 'yellow').length
    const greens = fits.filter((f) => f.level === 'green').length
    return { destination, fits, groupScore, reds, yellows, greens }
  })

  scored.sort((a, b) => {
    if (a.reds !== b.reds) return a.reds - b.reds
    return b.groupScore - a.groupScore
  })

  // Pick top options while keeping some diversity of destination type.
  const chosen = []
  const usedTypes = new Set()
  for (const candidate of scored) {
    if (chosen.length >= maxOptions) break
    const primaryType = candidate.destination.types[0]
    if (chosen.length > 0 && usedTypes.has(primaryType) && scored.length > maxOptions) continue
    chosen.push(candidate)
    usedTypes.add(primaryType)
  }
  while (chosen.length < Math.min(maxOptions, scored.length)) {
    const next = scored.find((s) => !chosen.includes(s))
    if (!next) break
    chosen.push(next)
  }

  return chosen.map((c) => buildOptionSummary(c))
}

function buildOptionSummary({ destination, fits, reds, greens }) {
  const strengths = []
  const consensusTypeHits = fits.filter((f) => f.reasons.some((r) => r.ok === true && r.text.includes('destination-type'))).length

  if (greens >= Math.ceil(fits.length * 0.6)) strengths.push('Matches most people’s destination preferences')
  const budgetOk = fits.filter((f) => !f.reasons.some((r) => r.text.toLowerCase().includes('budget') && r.ok !== true)).length
  if (budgetOk >= Math.ceil(fits.length * 0.6)) strengths.push('Fits the majority’s budget')
  const activityOverlap = fits.filter((f) => f.reasons.some((r) => r.ok === true && r.text.includes('activities'))).length
  if (activityOverlap >= Math.ceil(fits.length * 0.5)) strengths.push('Strong activity overlap')
  const vibeOverlap = fits.filter((f) => f.reasons.some((r) => r.ok === true && r.text.includes('vibe'))).length
  if (vibeOverlap >= Math.ceil(fits.length * 0.5)) strengths.push('Matches the trip vibe most people want')

  const whoCompromises = fits.filter((f) => f.level === 'yellow').map((f) => f.participant.name)
  const whoBlocked = fits.filter((f) => f.level === 'red').map((f) => f.participant.name)

  const compromiseNotes = []
  if (fits.some((f) => f.reasons.some((r) => r.ok !== true && r.text.toLowerCase().includes('budget')))) {
    compromiseNotes.push('Consider lower-cost accommodation or travel options to bring the cost down.')
  }
  if (fits.some((f) => f.reasons.some((r) => r.ok !== true && r.text.toLowerCase().includes('travel')))) {
    compromiseNotes.push('Travel time is longer than some would like — could be offset with a longer trip.')
  }

  let alignment = 'Strong alignment'
  if (reds > 0) alignment = 'Alignment with open conflicts'
  else if (strengths.length < 2) alignment = 'Partial alignment'

  return {
    name: destination.name,
    destination,
    alignment,
    strengths,
    whoCompromises,
    whoBlocked,
    compromiseNotes,
    fits,
  }
}
