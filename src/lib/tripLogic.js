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
// Methodology (deliberately not a keyword-match score):
// 1. Hard constraints (budget, national/international, travel time, trip
//    duration, dealbreakers) can never be bought back by a high preference
//    score — a destination that fails one is marked blocked for that person.
// 2. Soft preferences (kind of place, pace, stay, room sharing, travel mode)
//    are scored on a 0-1 "fit" scale per person, using each destination's
//    real profile — not a binary tag match.
// 3. Different travellers with different picks aren't assumed to conflict:
//    axes are mapped onto broader experience clusters (see
//    EXPERIENCE_CLUSTERS in destinations.js) so a destination strong on
//    both "Mountains" and "Parks & nature" can genuinely satisfy someone
//    who picked one and someone who picked the other.
// 4. Destinations are scored 0-100: preference fit (35) + group
//    compatibility (20, rewarding destinations that work reasonably for
//    everyone, not just on average) + budget (15) + travel time (10) +
//    duration (5) + pace (5) + stay (5) + travel mode (5).
// 5. Every shortlisted destination gets a full explanation: why it works
//    for each traveller individually, what shared experience it offers,
//    and its practical fit — grounded in that destination's own data.
// ---------------------------------------------------------------------------

// Hard constraints: if any of these fail, the destination cannot work for
// this person, full stop — no preference score can compensate.
function hardConstraintCheck(destination, response) {
  const reasons = []
  let blocked = false

  if (response.trip_scope === 'international' && destination.domestic) {
    blocked = true
    reasons.push('You wanted an international trip — this is domestic')
  } else if (response.trip_scope === 'national' && !destination.domestic) {
    blocked = true
    reasons.push('You wanted a national trip — this is international')
  }

  const ceiling = response.budget_ceiling
  if (ceiling && destination.budgetMin > ceiling) {
    blocked = true
    reasons.push(`Exceeds your maximum budget (₹${ceiling.toLocaleString('en-IN')})`)
  }

  const maxHours = travelTimeMaxHours(response.travel_time_max)
  if (destination.travelTimeHours > maxHours) {
    blocked = true
    reasons.push('Travel time is longer than your stated limit')
  }

  if (response.min_days && destination.recommendedDuration.max < response.min_days) {
    blocked = true
    reasons.push(`Needs more days than this trip usually takes (you need at least ${response.min_days})`)
  }
  if (response.max_days && destination.recommendedDuration.min > response.max_days) {
    blocked = true
    reasons.push(`Usually needs more days than you can spare (max ${response.max_days})`)
  }

  const dbs = response.no_dealbreakers ? [] : (response.dealbreakers || [])
  for (const db of dbs) {
    if (db === 'Exceeds my budget' && ceiling && destination.budgetMin > ceiling) {
      blocked = true
      reasons.push('Dealbreaker: exceeds your budget')
    }
    if (db === 'No long drives' && destination.travelModes.includes('Road') && destination.travelModes.length === 1 && destination.travelTimeHours > 6) {
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

function clamp01(n) {
  return Math.max(0, Math.min(1, n))
}

// Soft-preference fit scores, each 0-1. Computed only for destinations that
// already passed the hard-constraint check for this person.
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
    budgetFit = 0.5 + budgetFit * 0.5 // already survived the hard filter, so floor at 0.5
  }

  const maxHours = travelTimeMaxHours(response.travel_time_max)
  const travelFit = maxHours === Infinity ? 1 : clamp01(1 - (destination.travelTimeHours / maxHours) * 0.4)

  let durationFit = 1
  if (response.min_days || response.max_days) {
    const lo = response.min_days || destination.recommendedDuration.min
    const hi = response.max_days || destination.recommendedDuration.max
    const overlapLo = Math.max(lo, destination.recommendedDuration.min)
    const overlapHi = Math.min(hi, destination.recommendedDuration.max)
    durationFit = overlapHi >= overlapLo ? 1 : 0.6
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

// Full per-person evaluation: hard-constraint check + soft-preference fit,
// reduced to the {level, reasons} shape the person-level fit UI expects.
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
      } else if (strength <= 0.3) {
        reasons.push({ ok: 'warn', text: `${axis} isn't really what ${destination.name} is known for` })
      }
    }
  }
  if (details.budgetFit >= 0.85 && !hc.blocked) reasons.push({ ok: true, text: 'Comfortably within your budget' })
  else if (details.budgetFit < 0.65 && !hc.blocked) reasons.push({ ok: 'warn', text: 'Close to your maximum budget' })
  if (details.travelFit < 0.7) reasons.push({ ok: 'warn', text: 'Longer travel than you’d ideally want' })
  if (details.paceFit < 0.6) reasons.push({ ok: 'warn', text: `This place tends to run ${destination.typicalPace}-paced, not ${response.pace}` })
  if (details.stayFit < 0.6) reasons.push({ ok: 'warn', text: `Not many ${response.stay_type === 'hotel' ? 'hotel' : 'rental'} options here` })

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

// Produces 2-3 viable destinations with full group scoring and explanations.
export function generateOptions(participants, responsesByParticipant, maxOptions = 3) {
  const entries = completedResponses(participants, responsesByParticipant)
  if (entries.length === 0) return []

  const scored = DESTINATIONS.map((destination) => {
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

    return { destination, fits, reds, score100, avgPreferenceFit, groupCompatibility, primaryAxis }
  })

  scored.sort((a, b) => {
    if (a.reds !== b.reds) return a.reds - b.reds
    return b.score100 - a.score100
  })

  // Pick top options while keeping some diversity of primary experience.
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

  return chosen.map(buildOptionSummary)
}

function buildOptionSummary({ destination, fits, reds, score100, primaryAxis }) {
  const groupFitScore = Math.round(score100)

  let alignment = 'Strong alignment'
  if (reds > 0) alignment = 'Alignment with open conflicts'
  else if (groupFitScore < 55) alignment = 'Partial alignment'
  else if (groupFitScore < 75) alignment = 'Good alignment'

  // Why it works for each traveller, grounded in their actual picks.
  const perTraveller = fits.map(({ participant, response, blocked, reasons }) => {
    const bullets = []
    if (response.destination_no_pref || !(response.destination_types || []).length) {
      bullets.push({ preference: 'No preference expressed', matches: `open to whatever the group decides` })
    } else {
      for (const axis of response.destination_types) {
        const strength = destination.profile[axis] ?? 0.3
        bullets.push({
          preference: axis,
          matches: strength >= 0.6
            ? destination.highlights?.[axis] || `${destination.name}'s ${axis.toLowerCase()} side`
            : `${destination.name} isn't strongly known for this`,
          strong: strength >= 0.6,
        })
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
  if (blockedNames.length) practicalFit.push(`Dealbreaker or hard limit hit for: ${blockedNames.join(', ')}`)

  const whyShortlisted = reds > 0
    ? `Scores ${groupFitScore}/100 overall, but doesn't clear a hard constraint for ${blockedNames.join(', ')} — shown for transparency, not as a top pick.`
    : `Scores ${groupFitScore}/100 — strong on ${primaryAxis.toLowerCase()}, works within everyone's budget and travel limits, and had zero hard-constraint conflicts.`

  const whoCompromises = fits.filter((f) => f.level === 'yellow').map((f) => f.participant.name)
  const whoBlocked = blockedNames
  const strengths = []
  if (reds === 0) strengths.push('No hard-constraint conflicts for anyone')
  if (fits.every((f) => f.details.budgetFit >= 0.7)) strengths.push('Fits everyone’s budget comfortably')
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
