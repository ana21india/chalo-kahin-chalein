import { DESTINATIONS, EXPERIENCE_CLUSTERS } from './destinations'

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
  const beachLovers = entries.filter(({ response }) => !response.destination_no_pref && (response.destination_types || []).some((t) => /beach/i.test(t)))
  const mountainLovers = entries.filter(({ response }) => !response.destination_no_pref && (response.destination_types || []).some((t) => /mountain/i.test(t)))
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

// ---------------------------------------------------------------------------
// Destination recommendation engine
//
// Sequence: identify true hard constraints → compute the group's common
// date window (a global gate, not a per-destination penalty) → remove
// destinations failing hard constraints → read the group's national/
// international consensus → build a primary pool (matches the majority
// direction) and a wildcard pool (matches the minority, only if it clears
// its own bar) → score every surviving destination on preference fit,
// group compatibility/fairness, and practical fit → explain every result
// in terms of what each traveller actually asked for.
//
// TRUE hard constraints (eliminate outright, never bought back by a high
// preference score): the group's common date window, budget only when
// "Exceeds my budget" is an explicit dealbreaker, a stated maximum travel
// time, and any other explicit dealbreaker. National/international is
// deliberately NOT a per-person hard constraint — it's a group consensus
// signal that splits candidates into primary vs. wildcard pools instead.
// ---------------------------------------------------------------------------

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

function flexDays(flexibility) {
  switch (flexibility) {
    case 'flexible': return 3
    case 'very_flexible': return 10
    default: return 0
  }
}

// A person's acceptable travel window, expanded by their stated flexibility.
// Returns null if they didn't specify dates at all — someone who left dates
// blank places no constraint on the group's common window.
function personDateWindow(response) {
  if (!response.date_range_start && !response.date_range_end) return null
  const start = response.date_range_start ? new Date(response.date_range_start) : new Date(response.date_range_end)
  const end = response.date_range_end ? new Date(response.date_range_end) : new Date(response.date_range_start)
  const pad = flexDays(response.date_flexibility) * 24 * 60 * 60 * 1000
  return { start: new Date(start.getTime() - pad), end: new Date(end.getTime() + pad) }
}

// True hard constraint: dates are a group-level gate, computed once before
// any destination is even considered. It either fits everyone or it doesn't
// — a destination is never scored lower for a date mismatch, because if
// there's no common window, there's nothing to recommend at all yet.
function commonDateWindow(entries) {
  const windows = entries.map(({ response }) => personDateWindow(response)).filter(Boolean)
  if (windows.length === 0) return { exists: true }
  const start = new Date(Math.max(...windows.map((w) => w.start.getTime())))
  const end = new Date(Math.min(...windows.map((w) => w.end.getTime())))
  return { exists: start <= end, start, end }
}

// Hard constraints that eliminate a destination for one person — never
// compensated for by a high preference score elsewhere. Budget and travel
// time only block when the person marked them firmly (strict / hard limit);
// a "somewhat flexible" or "flexible" budget, or a "preference" travel-time
// cap, is scored instead of eliminating — see computeFitDetails.
function hardConstraintCheck(destination, response) {
  const reasons = []
  let blocked = false

  const dbs = response.no_dealbreakers ? [] : (response.dealbreakers || [])
  const ceiling = response.budget_ceiling
  const budgetFlex = response.budget_flexibility || 'strict'
  if (ceiling) {
    const effectiveCeiling = budgetFlex === 'somewhat_flexible' ? ceiling * 1.15 : ceiling
    if (budgetFlex !== 'flexible' && destination.budgetMin > effectiveCeiling) {
      blocked = true
      reasons.push(`Exceeds your ${budgetFlex === 'strict' ? 'strict' : 'stretched'} maximum budget (₹${ceiling.toLocaleString('en-IN')})`)
    }
  }

  if (response.travel_time_max && response.travel_time_max !== 'no_limit' && (response.travel_time_firmness || 'preference') === 'hard') {
    const maxHours = travelTimeMaxHours(response.travel_time_max)
    if (destination.travelTimeHours > maxHours) {
      blocked = true
      reasons.push('Travel time is longer than your hard limit')
    }
  }

  // A non-negotiable national/international answer is a personal hard
  // constraint for this person specifically, even though scope is normally
  // a group-consensus signal, not a per-person block (see scopeConsensus).
  if (response.scope_firmness === 'non_negotiable') {
    if (response.trip_scope === 'national' && !destination.domestic) {
      blocked = true
      reasons.push('You said national is non-negotiable — this is international')
    } else if (response.trip_scope === 'international' && destination.domestic) {
      blocked = true
      reasons.push('You said international is non-negotiable — this is domestic')
    }
  }

  for (const db of dbs) {
    if (db === 'No long drives' && destination.travelModes.length === 1 && destination.travelModes[0] === 'Road' && destination.travelTimeHours > 6) {
      blocked = true
      reasons.push('Dealbreaker: this is a long drive')
    }
    if (db === 'No trekking' && (destination.activities || []).includes('Trekking')) {
      blocked = true
      reasons.push('Dealbreaker: this place is trekking-heavy')
    }
  }

  return { blocked, reasons }
}

// Soft-preference fit scores, each 0-1 — scored, never eliminating.
function computeFitDetails(destination, response) {
  let preferenceFit = 1
  if (!response.destination_no_pref && (response.destination_types || []).length > 0) {
    const scores = response.destination_types.map((axis) => destination.profile[axis] ?? 0.3)
    preferenceFit = scores.reduce((a, b) => a + b, 0) / scores.length
  }

  let budgetFit = 1
  if (response.budget_ceiling) {
    const range = destination.budgetMax - destination.budgetMin || 1
    budgetFit = clamp01((response.budget_ceiling - destination.budgetMin) / range)
    const flex = response.budget_flexibility || 'strict'
    if (flex === 'flexible') budgetFit = Math.max(budgetFit, 0.65)
    else if (flex === 'somewhat_flexible') budgetFit = Math.max(budgetFit, 0.45)
  }

  let travelFit = 1
  if (response.travel_time_max && response.travel_time_max !== 'no_limit') {
    const maxHours = travelTimeMaxHours(response.travel_time_max)
    travelFit = clamp01(1 - (destination.travelTimeHours / maxHours) * 0.4)
  }

  let durationFit = 1
  if (response.min_days || response.max_days) {
    const lo = response.min_days || destination.recommendedDuration.min
    const hi = response.max_days || destination.recommendedDuration.max
    const overlapLo = Math.max(lo, destination.recommendedDuration.min)
    const overlapHi = Math.min(hi, destination.recommendedDuration.max)
    durationFit = overlapHi >= overlapLo ? 1 : 0.5
  }

  let paceFit = 1
  if (response.pace) {
    if (destination.typicalPace === 'either') paceFit = 0.85
    else paceFit = destination.typicalPace === response.pace ? 1 : 0.35
  }

  let stayFit = 1
  if (response.stay_type) {
    stayFit = destination.suitableStayTypes.includes(response.stay_type) ? 1 : 0.4
  }

  let travelModeFit = 1
  if (response.travel_mode && response.travel_mode !== 'Anything') {
    travelModeFit = destination.travelModes.includes(response.travel_mode) ? 1 : 0.4
  }

  return { preferenceFit, budgetFit, travelFit, durationFit, paceFit, stayFit, travelModeFit }
}

// Full per-person evaluation, reduced to the {level, reasons} shape the
// person-level fit UI expects. Only surfaces negatives for things the
// person actually specified (their budget, their travel limit, their
// pace/stay choice, their selected axes) — never for axes they never
// picked in the first place.
export function fitForDestination(destination, response) {
  const hc = hardConstraintCheck(destination, response)
  const details = computeFitDetails(destination, response)
  const reasons = []

  if (hc.blocked) {
    for (const r of hc.reasons) reasons.push({ ok: false, text: r })
  }

  if (!response.destination_no_pref && (response.destination_types || []).length > 0) {
    for (const axis of response.destination_types) {
      const strength = destination.profile[axis] ?? 0.3
      if (strength >= 0.6) {
        reasons.push({ ok: true, text: `${axis} → ${destination.highlights?.[axis] || `matches ${destination.name}'s profile`}` })
      }
    }
  }
  if (!hc.blocked && details.budgetFit >= 0.7) reasons.push({ ok: true, text: 'Comfortably within your budget' })
  else if (!hc.blocked && response.budget_ceiling && details.budgetFit < 0.55) reasons.push({ ok: 'warn', text: `Above your ${response.budget_flexibility === 'flexible' ? 'usual' : 'comfortable'} budget, but you said you're flexible` })
  if (response.travel_time_max && response.travel_time_max !== 'no_limit' && details.travelFit < 0.7) {
    reasons.push({ ok: 'warn', text: 'Longer travel than you’d ideally want' })
  }
  if (response.pace && details.paceFit < 0.6) reasons.push({ ok: 'warn', text: `This place tends to run ${destination.typicalPace}-paced, not ${response.pace}` })
  if (response.stay_type && details.stayFit < 0.6) reasons.push({ ok: 'warn', text: `Not many ${response.stay_type === 'hotel' ? 'hotel' : 'rental'} options here` })

  if (reasons.length === 0) reasons.push({ ok: 'warn', text: 'No strong signal either way' })

  const avgSoft = (details.preferenceFit + details.budgetFit + details.travelFit + details.durationFit + details.paceFit + details.stayFit + details.travelModeFit) / 7
  const level = hc.blocked ? 'red' : avgSoft >= 0.75 ? 'green' : 'yellow'

  return { level, score: avgSoft * 80, reasons, blocked: hc.blocked, details }
}

// Expands a person's selected axes into the broader experience clusters
// they map to (see EXPERIENCE_CLUSTERS) — this is what lets two people who
// picked different axes still be shown a genuine shared experience.
function personClusters(response) {
  if (response.destination_no_pref) return new Set()
  const clusters = new Set()
  for (const axis of response.destination_types || []) {
    for (const c of EXPERIENCE_CLUSTERS[axis] || []) clusters.add(c)
  }
  return clusters
}

function scoreDestination(destination, entries) {
  const fits = entries.map(({ participant, response }) => ({
    participant,
    response,
    ...fitForDestination(destination, response),
  }))

  const preferenceFits = fits.map((f) => f.details.preferenceFit)
  const avgPreferenceFit = preferenceFits.reduce((a, b) => a + b, 0) / preferenceFits.length
  const minPreferenceFit = Math.min(...preferenceFits)
  const groupCompatibility = 0.7 * avgPreferenceFit + 0.3 * minPreferenceFit

  const avg = (key) => fits.reduce((sum, f) => sum + f.details[key], 0) / fits.length

  const score100 =
    avgPreferenceFit * 35 +
    groupCompatibility * 20 +
    avg('budgetFit') * 15 +
    avg('travelFit') * 10 +
    avg('durationFit') * 5 +
    avg('paceFit') * 5 +
    avg('stayFit') * 5 +
    avg('travelModeFit') * 5

  const reds = fits.filter((f) => f.blocked).length
  const primaryAxis = Object.entries(destination.profile).sort((a, b) => b[1] - a[1])[0][0]

  return { destination, fits, reds, score100, avgPreferenceFit, minPreferenceFit, groupCompatibility, primaryAxis }
}

function firmnessWeight(firmness) {
  switch (firmness) {
    case 'non_negotiable': return 2
    case 'strong': return 1.5
    default: return 1
  }
}

// Group's national/international consensus. Excludes people who said
// "either" from the denominator — they don't push the group either way,
// but they don't get counted against a direction either. Firmer answers
// (strong preference / non-negotiable) pull the consensus harder than a
// merely "preferred" answer.
function scopeConsensus(entries) {
  let national = 0
  let international = 0
  for (const { response } of entries) {
    const w = firmnessWeight(response.scope_firmness)
    if (response.trip_scope === 'national') national += w
    else if (response.trip_scope === 'international') international += w
  }
  const total = national + international
  if (total === 0) return { direction: null, minority: null, majorityPct: 0 }
  const nationalPct = national / total
  const direction = nationalPct >= 0.5 ? 'national' : 'international'
  const majorityPct = Math.max(nationalPct, 1 - nationalPct)
  const minority = direction === 'national' ? 'international' : 'national'
  return { direction, minority, majorityPct, total }
}

function matchesScope(destination, direction) {
  if (!direction) return true
  return direction === 'national' ? destination.domestic : !destination.domestic
}

// True hard constraint: two travellers who both say their scope is
// non-negotiable, in opposite directions, cannot be reconciled by any
// destination — the group can't travel together until one of them budges.
function scopeConflict(entries) {
  const nonNegNational = entries.some(({ response }) => response.trip_scope === 'national' && response.scope_firmness === 'non_negotiable')
  const nonNegIntl = entries.some(({ response }) => response.trip_scope === 'international' && response.scope_firmness === 'non_negotiable')
  return nonNegNational && nonNegIntl
}

// True hard constraint: two travellers who both marked their days as fixed
// availability (not a rough target) with non-overlapping ranges can't
// actually travel together for any single trip length.
function durationConflict(entries) {
  const fixed = entries.filter(({ response }) => response.days_flexibility === 'fixed' && (response.min_days || response.max_days))
  if (fixed.length < 2) return false
  const lowestMax = Math.min(...fixed.map(({ response }) => response.max_days || response.min_days || Infinity))
  const highestMin = Math.max(...fixed.map(({ response }) => response.min_days || response.max_days || 0))
  return highestMin > lowestMax
}

// Produces 2-3 viable destinations with full group scoring and explanations,
// or a date-conflict result if the group has no common travel window at all.
export function generateOptions(participants, responsesByParticipant, maxOptions = 3) {
  const entries = completedResponses(participants, responsesByParticipant)
  if (entries.length === 0) return { dateConflict: false, options: [] }

  const dateWindow = commonDateWindow(entries)
  if (!dateWindow.exists) {
    return {
      dateConflict: true,
      conflictType: 'date',
      message: 'The group’s stated dates don’t overlap at all, even accounting for flexibility — there’s currently no common travel window, so no destinations can be recommended yet.',
      options: [],
    }
  }

  if (scopeConflict(entries)) {
    return {
      dateConflict: true,
      conflictType: 'scope',
      message: 'At least one person marked national as non-negotiable and another marked international as non-negotiable — no destination can satisfy both. The group needs to resolve this before options can be shown.',
      options: [],
    }
  }

  if (durationConflict(entries)) {
    return {
      dateConflict: true,
      conflictType: 'duration',
      message: 'At least two people marked their available days as fixed, and those ranges don’t overlap — there’s no trip length that works for everyone yet.',
      options: [],
    }
  }

  const scope = scopeConsensus(entries)
  const primaryCandidates = DESTINATIONS.filter((d) => matchesScope(d, scope.direction))
  const wildcardCandidates = scope.minority ? DESTINATIONS.filter((d) => matchesScope(d, scope.minority)) : []

  const scoredPrimary = primaryCandidates.map((d) => scoreDestination(d, entries))
  scoredPrimary.sort((a, b) => {
    if (a.reds !== b.reds) return a.reds - b.reds
    return b.score100 - a.score100
  })

  // Pick primary options while keeping diversity of primary experience.
  const chosen = []
  const usedAxes = new Set()
  const primarySlots = wildcardCandidates.length > 0 ? Math.max(1, maxOptions - 1) : maxOptions
  for (const candidate of scoredPrimary) {
    if (chosen.length >= primarySlots) break
    if (chosen.length > 0 && usedAxes.has(candidate.primaryAxis) && scoredPrimary.length > primarySlots) continue
    chosen.push(candidate)
    usedAxes.add(candidate.primaryAxis)
  }
  while (chosen.length < Math.min(primarySlots, scoredPrimary.length)) {
    const next = scoredPrimary.find((s) => !chosen.includes(s))
    if (!next) break
    chosen.push(next)
  }

  // Wildcard: only include a minority-scope destination if it clears its
  // own bar — strong for the minority traveller(s), still reasonable for
  // the group, and not just included because someone asked for it.
  let wildcard = null
  if (wildcardCandidates.length > 0) {
    const scoredWildcards = wildcardCandidates
      .map((d) => scoreDestination(d, entries))
      .filter((c) => c.reds === 0)
      .sort((a, b) => b.score100 - a.score100)
    const top = scoredWildcards[0]
    if (top) {
      const minorityFits = top.fits.filter(({ response }) => response.trip_scope === scope.minority)
      const minorityFitStrong = minorityFits.length > 0 && minorityFits.every((f) => f.details.preferenceFit >= 0.6)
      const groupStillReasonable = top.groupCompatibility >= 0.45
      if (minorityFitStrong && groupStillReasonable) {
        wildcard = top
      }
    }
  }

  const results = chosen.map((c) => buildOptionSummary(c, false))
  if (wildcard) results.push(buildOptionSummary(wildcard, true))

  return { dateConflict: false, options: results, scope }
}

function buildOptionSummary({ destination, fits, reds, score100, primaryAxis }, isWildcard) {
  const groupFitScore = Math.round(score100)

  let alignment = 'Strong alignment'
  if (reds > 0) alignment = 'Alignment with open conflicts'
  else if (groupFitScore < 55) alignment = 'Partial alignment'
  else if (groupFitScore < 75) alignment = 'Good alignment'

  // Why it works for each traveller — only their own selected preferences,
  // never a negative for something they didn't pick.
  const perTraveller = fits.map(({ participant, response, blocked, reasons }) => {
    const bullets = []
    if (response.destination_no_pref || !(response.destination_types || []).length) {
      bullets.push({ preference: 'No preference expressed', matches: 'open to whatever the group decides', strong: true })
    } else {
      for (const axis of response.destination_types) {
        const strength = destination.profile[axis] ?? 0.3
        if (strength >= 0.5) {
          bullets.push({ preference: axis, matches: destination.highlights?.[axis] || `${destination.name}'s ${axis.toLowerCase()} side`, strong: true })
        }
      }
      if (bullets.length === 0) {
        bullets.push({ preference: response.destination_types.join(' + '), matches: `${destination.name} doesn't strongly cover this, but was still the best available fit`, strong: false })
      }
    }
    return { name: participant.name, bullets, blocked, blockReasons: blocked ? reasons.filter((r) => r.ok === false).map((r) => r.text) : [] }
  })

  // Shared experiences: clusters that at least two travellers' picks both
  // feed into, backed by a destination axis that's actually strong there.
  const sharedExperiences = []
  if (fits.length >= 2) {
    const clusterCounts = {}
    fits.forEach(({ response }) => {
      for (const c of personClusters(response)) {
        clusterCounts[c] = (clusterCounts[c] || 0) + 1
      }
    })
    for (const [cluster, count] of Object.entries(clusterCounts)) {
      if (count < 2) continue
      const supportingAxis = Object.entries(destination.profile)
        .filter(([axis, score]) => score >= 0.6 && (EXPERIENCE_CLUSTERS[axis] || []).includes(cluster))
        .sort((a, b) => b[1] - a[1])[0]
      if (!supportingAxis) continue
      const [axis] = supportingAxis
      sharedExperiences.push({
        experience: cluster,
        why: `${destination.highlights?.[axis] || `${destination.name}'s ${axis.toLowerCase()} side`} gives everyone a ${cluster.toLowerCase()} experience, even with different picks`,
      })
    }
  }

  // Practical fit — the constraint-facing summary, not preference scoring.
  const practicalFit = []
  const ceilings = fits.map((f) => f.response.budget_ceiling).filter(Boolean)
  if (ceilings.length) {
    const lowest = Math.min(...ceilings)
    practicalFit.push(`Typical cost ₹${destination.budgetMin.toLocaleString('en-IN')}–₹${destination.budgetMax.toLocaleString('en-IN')} per person, against the group's lowest cap of ₹${lowest.toLocaleString('en-IN')}`)
  }
  practicalFit.push(`${destination.travelTimeHours}h typical travel time via ${destination.travelModes.join('/')}`)
  practicalFit.push(`Usually a ${destination.recommendedDuration.min}-${destination.recommendedDuration.max} day trip`)
  practicalFit.push(`Runs ${destination.typicalPace}-paced`)
  const blockedNames = fits.filter((f) => f.blocked).map((f) => f.participant.name)
  if (blockedNames.length) practicalFit.push(`Dealbreaker hit for: ${blockedNames.join(', ')}`)

  const whyShortlisted = reds > 0
    ? `Scores ${groupFitScore}/100 overall, but doesn't clear a hard constraint for ${blockedNames.join(', ')} — shown for transparency, not as a top pick.`
    : isWildcard
      ? `A wildcard: it's the minority pick in the group, but it's strong for the person(s) who wanted it and still scores ${groupFitScore}/100 for the group overall.`
      : `Scores ${groupFitScore}/100 — strong on ${primaryAxis.toLowerCase()}, works within everyone's budget and travel limits, and had zero hard-constraint conflicts.`

  const whoCompromises = fits.filter((f) => f.level === 'yellow').map((f) => f.participant.name)
  const whoBlocked = blockedNames
  const strengths = []
  if (reds === 0) strengths.push('No hard-constraint conflicts for anyone')
  if (fits.every((f) => f.details.budgetFit >= 0.6)) strengths.push('Fits everyone’s budget comfortably')
  if (sharedExperiences.length > 0) strengths.push('Genuine shared experience across different picks')

  return {
    name: destination.name,
    destination,
    alignment,
    groupFitScore,
    isWildcard: Boolean(isWildcard),
    strengths,
    whoCompromises,
    whoBlocked,
    compromiseNotes: [],
    perTraveller,
    sharedExperiences,
    practicalFit,
    whyShortlisted,
    fits,
  }
}
