import { DESTINATIONS, EXPERIENCE_CLUSTERS } from './destinations'
import { estimateTravelHours } from './travelTimes'

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

// Consensus for one field, single- or multi-select. Every row carries the
// actual people behind it — "who said this" is never hidden behind a bare
// count, since a majority bar with no names is a majority you can't check.
// When `allOptions` is given, every option is included even at 0/0 —
// otherwise an option nobody picked would just silently disappear, which
// looks like the question was never asked rather than answered with "no".
// `detailField`/`detailLabelMap` attach a second, per-person answer (e.g.
// travel_time_firmness alongside travel_time_max) so a viewer can see not
// just what someone picked but how firmly, without a separate lookup.
export function fieldConsensus(participants, responsesByParticipant, field, {
  labelMap = {}, allOptions = null, isMulti = false, noPrefField = null, detailField = null, detailLabelMap = {},
} = {}) {
  const entries = completedResponses(participants, responsesByParticipant)
  const relevant = noPrefField ? entries.filter(({ response }) => !response[noPrefField]) : entries
  const counts = {}
  const peopleByOption = {}
  let answeredCount = 0
  for (const { participant, response } of relevant) {
    const raw = response[field]
    const values = isMulti ? (Array.isArray(raw) ? raw : []) : (raw ? [raw] : [])
    if (values.length > 0) answeredCount += 1
    for (const v of values) {
      counts[v] = (counts[v] || 0) + 1
      const detail = detailField ? (detailLabelMap[response[detailField]] || response[detailField]) : null
      if (!peopleByOption[v]) peopleByOption[v] = []
      peopleByOption[v].push({ name: participant.name, detail })
    }
  }
  const denom = relevant.length
  const keys = allOptions || Object.keys(counts)
  const rows = keys.map((option) => ({
    option: labelMap[option] || option,
    count: counts[option] || 0,
    total: denom,
    people: peopleByOption[option] || [],
  }))
  if (!isMulti) {
    const unanswered = denom - answeredCount
    if (unanswered > 0) rows.push({ option: 'Not specified', count: unanswered, total: denom, people: [] })
  }
  return rows.sort((a, b) => b.count - a.count)
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

  return conflicts
}

// ---------------------------------------------------------------------------
// Destination recommendation engine
//
// Sequence: identify true hard constraints → compute the group's common
// date window (a global gate, not a per-destination penalty) → filter out
// destinations that fail anyone's hard travel-time limit → score every
// surviving destination on preference fit, group compatibility/fairness,
// and practical fit → explain every result in terms of what each traveller
// actually asked for.
//
// TRUE hard constraints (eliminate outright, never bought back by a high
// preference score): the group's common date window, a hard travel-time
// limit, and any other explicit dealbreaker. There is deliberately no
// national/international field at all — see the product decision to drop
// it in favour of destination-level constraints (budget, travel time,
// dates) actually capturing what matters.
// ---------------------------------------------------------------------------

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

// Best real travel-time estimate for one person to one destination, given
// their requested mode(s). Falls back to the destination's generic
// (Mumbai/Delhi-hub-ish) number when we have no curated route for their
// city — `isEstimate: true` flags that fallback so callers can be honest
// about it instead of presenting a guess as a measured number.
function travelHoursForPerson(destination, response) {
  const requestedModes = response.travel_mode && response.travel_mode !== 'Anything' ? [response.travel_mode] : destination.travelModes
  const availableModes = requestedModes.filter((m) => destination.travelModes.includes(m))
  if (availableModes.length === 0) {
    // The requested mode doesn't reach this destination at all — treat it
    // as a poor (not feasible-but-slow) fit rather than the fallback time.
    return { hours: destination.travelTimeHours * 2, isEstimate: true }
  }
  if (response.starting_city) {
    const estimates = availableModes
      .map((m) => estimateTravelHours(destination.name, response.starting_city, m))
      .filter((h) => h != null)
    if (estimates.length > 0) return { hours: Math.min(...estimates), isEstimate: false }
  }
  return { hours: destination.travelTimeHours, isEstimate: true }
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

  // Travel time is NOT checked here — a hard travel-time limit filters the
  // destination out of the candidate pool entirely (see
  // destinationTravelFeasible / travelFeasibleForGroup below), it never
  // shows up as a "blocked, but still listed" conflict the way budget does.
  // See the architecture note above generateOptions.

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
    const actualHours = travelHoursForPerson(destination, response).hours
    travelFit = clamp01(1 - (actualHours / maxHours) * 0.4)
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

// Independent status of each trip-level gate, all evaluated regardless of
// which one generateOptions would actually short-circuit on first — so a
// summary view can show every gate's state at once instead of only the
// first failure the engine happens to hit.
export function tripLevelChecks(participants, responsesByParticipant) {
  const entries = completedResponses(participants, responsesByParticipant)
  const dateWindow = commonDateWindow(entries)
  return {
    dateOk: dateWindow.exists,
    durationOk: !durationConflict(entries),
  }
}

// Layer 2 — destination-level travel feasibility. A hard travel-time limit
// eliminates a DESTINATION from the candidate pool; it never eliminates the
// trip. Respects the traveller's chosen mode exactly (a flight time can
// never rescue a "Train, hard limit" answer), compares against real
// mode/origin-aware durations where we have them, and only ever blocks on
// "preference"-firmness data we actually have — never on a hallucinated
// number. See travelTimes.js.
function destinationTravelFeasible(destination, response) {
  if (!response.travel_time_max || response.travel_time_max === 'no_limit') return { feasible: true }
  if ((response.travel_time_firmness || 'preference') !== 'hard') return { feasible: true }

  const maxHours = travelTimeMaxHours(response.travel_time_max)
  const requestedModes = response.travel_mode && response.travel_mode !== 'Anything' ? [response.travel_mode] : destination.travelModes

  // The requested mode doesn't serve this destination at all (e.g. Train to
  // Bali) — genuinely unreachable, independent of any time estimate.
  const availableModes = requestedModes.filter((m) => destination.travelModes.includes(m))
  if (availableModes.length === 0) {
    return { feasible: false, reason: `Not reachable by ${requestedModes.join('/')}` }
  }

  if (!response.starting_city) return { feasible: true }

  const estimates = availableModes
    .map((m) => estimateTravelHours(destination.name, response.starting_city, m))
    .filter((h) => h != null)
  if (estimates.length === 0) return { feasible: true } // no curated data for this route — don't guess

  const best = Math.min(...estimates)
  if (best > maxHours) {
    return { feasible: false, reason: `From ${response.starting_city}, the fastest option (${availableModes.join('/')}) is ~${Math.round(best)}h — over the hard limit` }
  }
  return { feasible: true }
}

function travelFeasibleForGroup(destination, entries) {
  return entries.every(({ response }) => destinationTravelFeasible(destination, response).feasible)
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

  if (durationConflict(entries)) {
    return {
      dateConflict: true,
      conflictType: 'duration',
      message: 'At least two people marked their available days as fixed, and those ranges don’t overlap — there’s no trip length that works for everyone yet.',
      options: [],
    }
  }

  const travelFeasible = (d) => travelFeasibleForGroup(d, entries)
  const candidates = DESTINATIONS.filter(travelFeasible)

  if (candidates.length === 0) {
    return {
      dateConflict: true,
      conflictType: 'travel',
      message: 'No destination is currently reachable within everyone’s hard travel-time limits and chosen transport modes — this isn’t about whether the group can travel together, just that none of the candidate destinations clear everyone’s travel bar yet. Relaxing a travel-time limit, its strictness, or the transport mode for whoever is most restrictive would open up options.',
      options: [],
    }
  }

  const scored = candidates.map((d) => scoreDestination(d, entries))
  scored.sort((a, b) => {
    if (a.reds !== b.reds) return a.reds - b.reds
    return b.score100 - a.score100
  })

  // Pick options while keeping diversity of primary experience — don't
  // shortlist two beach-primary destinations back to back.
  const chosen = []
  const usedAxes = new Set()
  for (const candidate of scored) {
    if (chosen.length >= maxOptions) break
    if (chosen.length > 0 && usedAxes.has(candidate.primaryAxis) && scored.length > maxOptions) continue
    chosen.push(candidate)
    usedAxes.add(candidate.primaryAxis)
  }
  while (chosen.length < Math.min(maxOptions, scored.length)) {
    const next = scored.find((s) => !chosen.includes(s))
    if (!next) break
    chosen.push(next)
  }

  const results = chosen.map((c) => buildOptionSummary(c))

  return { dateConflict: false, options: results }
}

function buildOptionSummary({ destination, fits, reds, score100, primaryAxis }) {
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
  const travelEstimates = fits.map(({ participant, response }) => ({ name: participant.name, ...travelHoursForPerson(destination, response) }))
  const anyRealEstimate = travelEstimates.some((t) => !t.isEstimate)
  if (anyRealEstimate) {
    const anyFallback = travelEstimates.some((t) => t.isEstimate)
    const parts = travelEstimates.map((t) => `${t.name} ~${Math.round(t.hours * 10) / 10}h${t.isEstimate ? ' (rough estimate)' : ''}`)
    practicalFit.push(`Travel time by ${destination.travelModes.join('/')}: ${parts.join(', ')}${anyFallback ? ' — no curated route data for everyone\'s city, so some figures are the destination\'s general estimate' : ''}`)
  } else {
    practicalFit.push(`${destination.travelTimeHours}h typical travel time via ${destination.travelModes.join('/')} (general estimate — no curated route data for this group's cities)`)
  }
  practicalFit.push(`Usually a ${destination.recommendedDuration.min}-${destination.recommendedDuration.max} day trip`)
  practicalFit.push(`Runs ${destination.typicalPace}-paced`)
  const blockedNames = fits.filter((f) => f.blocked).map((f) => f.participant.name)
  if (blockedNames.length) practicalFit.push(`Dealbreaker hit for: ${blockedNames.join(', ')}`)

  const whyShortlisted = reds > 0
    ? `Scores ${groupFitScore}/100 overall, but doesn't clear a hard constraint for ${blockedNames.join(', ')} — shown for transparency, not as a top pick.`
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
