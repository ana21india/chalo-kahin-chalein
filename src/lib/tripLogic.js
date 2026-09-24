import { DESTINATIONS } from './destinations'

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

// Consensus for a Top-N phase: only counts people who expressed an actual
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

// Consensus for a single-select field (pace, stay type, room sharing).
export function singleFieldConsensus(participants, responsesByParticipant, field, labelMap = {}) {
  const entries = completedResponses(participants, responsesByParticipant)
  const answered = entries.filter(({ response }) => response[field])
  const counts = {}
  for (const { response } of answered) {
    const v = response[field]
    counts[v] = (counts[v] || 0) + 1
  }
  const denom = answered.length
  return Object.entries(counts)
    .map(([option, count]) => ({ option: labelMap[option] || option, count, total: denom }))
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

function isMountainType(t) {
  return /mountain/i.test(t)
}
function isBeachType(t) {
  return /beach/i.test(t)
}

// Surfaces meaningful group splits rather than hiding them inside one score.
export function computeConflicts(participants, responsesByParticipant) {
  const entries = completedResponses(participants, responsesByParticipant)
  const conflicts = []

  // Budget conflict: everyone's max budget is a hard ceiling by design, so a
  // wide spread of ceilings is itself the split worth surfacing.
  const withBudget = entries.filter(({ response }) => response.budget_ceiling)
  if (withBudget.length > 1) {
    const lowest = Math.min(...withBudget.map(({ response }) => response.budget_ceiling))
    const tight = withBudget.filter(({ response }) => response.budget_ceiling <= lowest * 1.15)
    const loose = withBudget.filter(({ response }) => response.budget_ceiling > lowest * 1.15)
    if (tight.length > 0 && loose.length > 0) {
      conflicts.push({
        type: 'budget',
        title: 'Budget split',
        description: `${tight.length} ${tight.length === 1 ? 'person has' : 'people have'} a hard maximum around ₹${lowest.toLocaleString('en-IN')}, while ${loose.length} ${loose.length === 1 ? 'person is' : 'people are'} comfortable well above that.`,
        groups: [
          { label: `Maximum ~₹${lowest.toLocaleString('en-IN')}`, people: tight.map(({ participant }) => participant.name) },
          { label: 'Comfortable higher', people: loose.map(({ participant }) => participant.name) },
        ],
      })
    }
  }

  // Pace conflict: packed vs slow.
  const packed = entries.filter(({ response }) => response.pace === 'packed')
  const slow = entries.filter(({ response }) => response.pace === 'slow')
  if (packed.length > 0 && slow.length > 0) {
    conflicts.push({
      type: 'pace',
      title: 'Pace split',
      description: `${slow.length} ${slow.length === 1 ? 'person wants' : 'people want'} a slow trip, while ${packed.length} ${packed.length === 1 ? 'person wants' : 'people want'} a packed itinerary.`,
      groups: [
        { label: 'Slow', people: slow.map(({ participant }) => participant.name) },
        { label: 'Packed', people: packed.map(({ participant }) => participant.name) },
      ],
    })
  }

  // Stay-type conflict: hotel vs rental.
  const hotel = entries.filter(({ response }) => response.stay_type === 'hotel')
  const rental = entries.filter(({ response }) => response.stay_type === 'rental')
  if (hotel.length > 0 && rental.length > 0) {
    conflicts.push({
      type: 'stay',
      title: 'Stay-type split',
      description: `${hotel.length} ${hotel.length === 1 ? 'person prefers' : 'people prefer'} a hotel, ${rental.length} ${rental.length === 1 ? 'person prefers' : 'people prefer'} a rental.`,
      groups: [
        { label: 'Hotel', people: hotel.map(({ participant }) => participant.name) },
        { label: 'Rental', people: rental.map(({ participant }) => participant.name) },
      ],
    })
  }

  // Room-sharing conflict.
  const shared = entries.filter(({ response }) => response.room_sharing === 'shared')
  const separate = entries.filter(({ response }) => response.room_sharing === 'separate')
  if (shared.length > 0 && separate.length > 0) {
    conflicts.push({
      type: 'rooms',
      title: 'Room-sharing split',
      description: `${separate.length} ${separate.length === 1 ? 'person wants' : 'people want'} separate rooms, ${shared.length} ${shared.length === 1 ? 'person is' : 'people are'} fine sharing.`,
      groups: [
        { label: 'Shared rooms', people: shared.map(({ participant }) => participant.name) },
        { label: 'Separate rooms', people: separate.map(({ participant }) => participant.name) },
      ],
    })
  }

  // Destination-type conflict: beach vs mountains being the classic split.
  const beachLovers = entries.filter(({ response }) => !response.destination_no_pref && (response.destination_types || []).some(isBeachType))
  const mountainLovers = entries.filter(({ response }) => !response.destination_no_pref && (response.destination_types || []).some(isMountainType))
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

  // National vs international split.
  const wantsNational = entries.filter(({ response }) => response.trip_scope === 'national')
  const wantsIntl = entries.filter(({ response }) => response.trip_scope === 'international')
  if (wantsNational.length > 0 && wantsIntl.length > 0) {
    conflicts.push({
      type: 'scope',
      title: 'National vs. international split',
      description: `${wantsNational.length} ${wantsNational.length === 1 ? 'person wants' : 'people want'} a national trip, ${wantsIntl.length} ${wantsIntl.length === 1 ? 'person wants' : 'people want'} international.`,
      groups: [
        { label: 'National', people: wantsNational.map(({ participant }) => participant.name) },
        { label: 'International', people: wantsIntl.map(({ participant }) => participant.name) },
      ],
    })
  }

  return conflicts
}

// "Culture" (shown in the UI) maps to the catalog's "Cultural" tag.
function catalogTypeAliases(t) {
  if (t === 'Culture') return ['Culture', 'Cultural']
  return [t]
}

function overlapScore(selected = [], catalogTypes = []) {
  if (!selected.length || !catalogTypes.length) return 0
  const setB = new Set(catalogTypes)
  const hits = selected.filter((x) => catalogTypeAliases(x).some((alias) => setB.has(alias))).length
  return hits / selected.length
}

// Evaluates how a single destination fits one participant's response,
// treating deal-breakers and the hard budget ceiling as constraints that a
// majority preference cannot simply override.
export function fitForDestination(destination, response) {
  const reasons = []
  let level = 'green'
  let score = 0

  if (!response.destination_no_pref) {
    const s = overlapScore(response.destination_types, destination.types)
    score += s * 3
    if (s > 0) reasons.push({ ok: true, text: 'Matches the kind of trip you want' })
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

  if (response.pace === 'packed' && destination.vibes.includes('Packed')) {
    score += 1.5
    reasons.push({ ok: true, text: 'Matches the packed pace you want' })
  } else if (response.pace === 'slow' && destination.vibes.some((v) => ['Slow', 'Relaxed'].includes(v))) {
    score += 1.5
    reasons.push({ ok: true, text: 'Matches the slow pace you want' })
  } else if (response.pace === 'packed' && destination.vibes.some((v) => ['Slow', 'Relaxed'].includes(v))) {
    reasons.push({ ok: 'warn', text: 'This place tends to be slower-paced than you want' })
  } else if (response.pace === 'slow' && destination.vibes.includes('Packed')) {
    reasons.push({ ok: 'warn', text: 'This place tends to be more packed than you want' })
  }

  // Budget — a hard ceiling by design (per-person max, per the fairness rule
  // that a majority preference must not override someone's hard limit).
  const ceiling = response.budget_ceiling
  if (ceiling) {
    if (destination.budgetMin > ceiling) {
      level = 'red'
      reasons.push({ ok: false, text: `Exceeds your maximum budget (₹${ceiling.toLocaleString('en-IN')})` })
    } else if (destination.budgetMax > ceiling) {
      if (level !== 'red') level = 'yellow'
      reasons.push({ ok: 'warn', text: 'Close to your maximum budget' })
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

  // Deal-breakers — always hard constraints where we have data to check them.
  const dbs = response.no_dealbreakers ? [] : (response.dealbreakers || [])
  for (const db of dbs) {
    if (db === 'Exceeds my budget' && ceiling && destination.budgetMin > ceiling) {
      level = 'red'
      reasons.push({ ok: false, text: 'Dealbreaker: exceeds your budget' })
    }
    if (db === 'No long drives' && destination.travelModes.includes('Road') && destination.travelTimeHours > 6) {
      level = 'red'
      reasons.push({ ok: false, text: 'Dealbreaker: this is a long drive' })
    }
    if (db === 'No trekking' && destination.activities.includes('Trekking')) {
      level = 'red'
      reasons.push({ ok: false, text: 'Dealbreaker: this place is trekking-heavy' })
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
    const greens = fits.filter((f) => f.level === 'green').length
    return { destination, fits, groupScore, reds, greens }
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

  if (greens >= Math.ceil(fits.length * 0.6)) strengths.push('Matches most people’s idea of the trip')
  const budgetOk = fits.filter((f) => !f.reasons.some((r) => r.text.toLowerCase().includes('budget') && r.ok !== true)).length
  if (budgetOk >= Math.ceil(fits.length * 0.6)) strengths.push('Fits the majority’s budget')
  const paceOverlap = fits.filter((f) => f.reasons.some((r) => r.ok === true && r.text.includes('pace'))).length
  if (paceOverlap >= Math.ceil(fits.length * 0.5)) strengths.push('Matches the pace most people want')

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
