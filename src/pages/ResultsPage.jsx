import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, AlertTriangle, Vote as VoteIcon } from 'lucide-react'
import { Screen, TopBar, Button, Card, Pill } from '../components/ui'
import { getStoredParticipant } from '../lib/constants'
import { getTrip, getParticipants, getResponses, getVotes, castVote, subscribeToTrip, setTripStatus, saveDiscoveredDestinations } from '../lib/api'
import { completionCounts, fieldConsensus, computeConflicts, generateOptions, tripLevelChecks, computeBudgetBand } from '../lib/tripLogic'
import { DESTINATIONS } from '../lib/destinations'
import {
  PACE_OPTIONS, STAY_OPTIONS, ROOM_OPTIONS, TRAVEL_TIME_OPTIONS, TRIP_TYPE_OPTIONS, TRAVEL_MODES,
  TRAVEL_TIME_FIRMNESS_OPTIONS, BUDGET_FLEXIBILITY_OPTIONS, DAYS_FLEXIBILITY_OPTIONS,
  DEALBREAKERS, BUDGET_SCOPE_OPTIONS, DATE_FLEXIBILITY_OPTIONS,
} from '../lib/constants'

const optionValues = (options) => options.map((o) => (typeof o === 'string' ? o : o.value))

function labelMapFrom(options) {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

const TABS = ['Consensus', 'Conflicts', 'Options', 'Decide']

export default function ResultsPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const participant = getStoredParticipant(tripId)
  const [trip, setTrip] = useState(null)
  const [participants, setParticipants] = useState([])
  const [responses, setResponses] = useState({})
  const [votes, setVotes] = useState([])
  const [tab, setTab] = useState('Consensus')

  async function load() {
    const [t, ps, rs, vs] = await Promise.all([getTrip(tripId), getParticipants(tripId), getResponses(tripId), getVotes(tripId)])
    setTrip(t)
    setParticipants(ps)
    const byId = {}
    rs.forEach((r) => { byId[r.participant_id] = r })
    setResponses(byId)
    setVotes(vs)
  }

  useEffect(() => {
    if (!participant?.id) {
      navigate(`/trip/${tripId}`, { replace: true })
      return
    }
    load()
    const unsub = subscribeToTrip(tripId, load)
    return unsub
  }, [tripId])

  const counts = useMemo(() => completionCounts(participants, responses), [participants, responses])
  const conflicts = useMemo(() => computeConflicts(participants, responses), [participants, responses])

  // "Open to the world" is driven entirely by the group's AGGREGATED
  // preferences, never by one person naming a place — naming a destination
  // directly reintroduces the exact "person A wants Bali, the group never
  // agreed" problem this app exists to prevent. Gemini only ever sees a
  // summary (top preference axes, budget, duration, group size), suggests
  // destination names the curated catalog doesn't cover, and those are
  // estimated and scored exactly like everything else — no individual
  // input, no special status.
  const completedResponses = Object.values(responses).filter((r) => r?.status === 'completed')
  const axisCounts = {}
  for (const r of completedResponses) {
    if (r.destination_no_pref) continue
    for (const axis of r.destination_types || []) axisCounts[axis] = (axisCounts[axis] || 0) + 1
  }
  const topAxes = Object.entries(axisCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([axis]) => axis)
  const ceilings = completedResponses.map((r) => r.budget_ceiling).filter(Boolean)
  const budgetMin = ceilings.length ? Math.min(...ceilings) : null
  const durations = completedResponses.map((r) => r.max_days || r.min_days).filter(Boolean)
  const aggregateKey = JSON.stringify({ topAxes, budgetMin, groupSize: completedResponses.length })
  const [extraDestinations, setExtraDestinations] = useState([])
  useEffect(() => {
    if (completedResponses.length < 2) {
      setExtraDestinations([])
      return
    }
    // Reuse the cached result for this exact aggregate profile — otherwise
    // a plain refresh (or a second person opening Results) would re-roll
    // Gemini's non-deterministic suggestion and show a different set of
    // "open to the world" destinations for the same group data, with no
    // real change to explain it.
    if (trip?.discovered_aggregate_key === aggregateKey && Array.isArray(trip?.discovered_destinations)) {
      setExtraDestinations(trip.discovered_destinations)
      return
    }
    let cancelled = false
    fetch('/api/discover-destinations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topAxes,
        budgetMin,
        groupSize: completedResponses.length,
        durationMin: durations.length ? Math.min(...durations) : null,
        durationMax: durations.length ? Math.max(...durations) : null,
        excludeNames: DESTINATIONS.map((d) => d.name),
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        const result = Array.isArray(data) ? data : []
        setExtraDestinations(result)
        saveDiscoveredDestinations(tripId, aggregateKey, result).catch((e) => console.warn('Failed to cache discovered destinations:', e.message))
      })
      .catch((e) => {
        console.warn('AI destination discovery unavailable, using curated catalog only:', e.message)
        if (!cancelled) setExtraDestinations([])
      })
    return () => { cancelled = true }
  }, [aggregateKey, trip?.id])

  // AI-suggested destinations come with Gemini's own guessed distance,
  // which has been demonstrably wrong for real places (see tripLogic.js).
  // Once we know the group's actual origin cities, verify each AI
  // destination's real road distance/time via free geocoding + routing
  // (api/_lib/geo.js) and merge it in as `realDistances`, so the engine can
  // sanity-check the AI's guess against reality instead of trusting it
  // outright. Only fetches for (destination, city) pairs not already
  // verified, and persists the result back into the same cached record.
  const originCitiesKey = [...new Set(completedResponses.map((r) => r.starting_city).filter(Boolean))].sort().join('|')
  useEffect(() => {
    if (extraDestinations.length === 0 || !originCitiesKey) return
    const originCities = originCitiesKey.split('|')
    const missing = extraDestinations.filter((d) => originCities.some((city) => !d.realDistances || d.realDistances[city] === undefined))
    if (missing.length === 0) return
    let cancelled = false
    fetch('/api/verify-distances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinations: missing.map((d) => ({ name: d.name })), originCities }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        const merged = extraDestinations.map((d) => ({
          ...d,
          realDistances: { ...(d.realDistances || {}), ...(data[d.name] || {}) },
        }))
        setExtraDestinations(merged)
        saveDiscoveredDestinations(tripId, aggregateKey, merged).catch((e) => console.warn('Failed to cache verified distances:', e.message))
      })
      .catch((e) => console.warn('Distance verification unavailable:', e.message))
    return () => { cancelled = true }
  }, [extraDestinations.map((d) => d.name).join('|'), originCitiesKey])

  const optionsResult = useMemo(() => generateOptions(participants, responses, 3, extraDestinations), [participants, responses, extraDestinations])
  const options = optionsResult.options

  const [aiExplanations, setAiExplanations] = useState({})
  const [aiStatus, setAiStatus] = useState('idle') // idle | loading | done | error
  const optionsKey = options.map((o) => o.name).join('|')
  useEffect(() => {
    if (options.length === 0) return
    let cancelled = false
    setAiStatus('loading')
    fetch('/api/explain-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options, groupSize: counts.completed }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((data) => {
        if (cancelled) return
        setAiExplanations(data || {})
        setAiStatus('done')
      })
      .catch((e) => {
        if (cancelled) return
        console.warn('AI explanations unavailable, falling back to rule-based text:', e.message)
        setAiStatus('error')
      })
    return () => { cancelled = true }
  }, [optionsKey])

  if (!trip) {
    return <Screen><div className="flex-1 flex items-center justify-center"><p className="text-sm text-neutral-400">Loading…</p></div></Screen>
  }

  if (counts.completed < 2) {
    return (
      <Screen>
        <TopBar title="Group results" onBack={() => navigate(-1)} />
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-sm text-neutral-500">Results unlock once at least 2 people submit their preferences. Right now {counts.completed} of {counts.total} have responded.</p>
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar title="What does our group want?" subtitle={`Based on ${counts.completed} of ${counts.total} responses${counts.completed < counts.total ? ' — not everyone has submitted yet' : ''}`} onBack={() => navigate(-1)} />

      <div className="px-5 mt-2 mb-1">
        <div className="flex bg-neutral-100 rounded-2xl p-1 gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${tab === t ? 'bg-white text-neutral-900 shadow-soft' : 'text-neutral-400'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-5 py-4 overflow-y-auto pb-10 space-y-4">
        {tab === 'Consensus' && <ConsensusTab participants={participants} responses={responses} />}
        {tab === 'Conflicts' && <ConflictsTab conflicts={conflicts} />}
        {tab === 'Options' && <OptionsTab optionsResult={optionsResult} counts={counts} aiExplanations={aiExplanations} aiStatus={aiStatus} />}
        {tab === 'Decide' && (
          <DecideTab
            tripId={tripId}
            trip={trip}
            options={options}
            participants={participants}
            votes={votes}
            participant={participant}
            counts={counts}
            onVoted={load}
          />
        )}
      </div>
    </Screen>
  )
}

function ConsensusRow({ label, items }) {
  // Bar width is share of the WHOLE group (count/total), not relative to
  // whichever option got the most votes — a 1-of-2 split used to render as
  // a full solid bar (same width as a 2-of-2 unanimous pick), which looked
  // like unanimous agreement when it was really a 50/50 split.
  const picked = items.filter((it) => it.count > 0)
  const unpicked = items.filter((it) => it.count === 0 && it.option !== 'Not specified')
  return (
    <div className="mb-5 last:mb-0">
      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">{label}</div>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">No preferences expressed yet.</p>
      ) : (
        <div className="space-y-2">
          {picked.map((it) => (
            <div key={it.option}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-neutral-800 font-medium">{it.option}</span>
                <span className="text-neutral-400">{it.count}/{it.total}</span>
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div className="h-full bg-sunset-500 rounded-full" style={{ width: `${(it.count / it.total) * 100}%` }} />
              </div>
              {it.people && it.people.length > 0 && (
                <div className="text-[11px] text-neutral-400 mt-1">
                  {it.people.map((p) => (p.detail ? `${p.name} (${p.detail})` : p.name)).join(', ')}
                </div>
              )}
            </div>
          ))}
          {picked.length === 0 && <p className="text-sm text-neutral-400">Nobody picked any option yet.</p>}
          {unpicked.length > 0 && (
            <p className="text-[11px] text-neutral-300">Not picked: {unpicked.map((it) => it.option).join(', ')}</p>
          )}
        </div>
      )}
    </div>
  )
}

function ConsensusTab({ participants, responses }) {
  const checks = tripLevelChecks(participants, responses)
  const completed = participants.filter((p) => responses[p.id]?.status === 'completed')
  const places = fieldConsensus(participants, responses, 'destination_types', {
    allOptions: optionValues(TRIP_TYPE_OPTIONS), isMulti: true, noPrefField: 'destination_no_pref',
  })
  const startingPoints = fieldConsensus(participants, responses, 'starting_city')
  const travelMode = fieldConsensus(participants, responses, 'travel_mode', { allOptions: optionValues(TRAVEL_MODES) })
  const travelTime = fieldConsensus(participants, responses, 'travel_time_max', {
    labelMap: labelMapFrom(TRAVEL_TIME_OPTIONS), allOptions: optionValues(TRAVEL_TIME_OPTIONS),
    detailField: 'travel_time_firmness', detailLabelMap: labelMapFrom(TRAVEL_TIME_FIRMNESS_OPTIONS),
  })
  const budgetFlex = fieldConsensus(participants, responses, 'budget_flexibility', {
    labelMap: labelMapFrom(BUDGET_FLEXIBILITY_OPTIONS), allOptions: optionValues(BUDGET_FLEXIBILITY_OPTIONS),
  })
  const daysFlex = fieldConsensus(participants, responses, 'days_flexibility', {
    labelMap: labelMapFrom(DAYS_FLEXIBILITY_OPTIONS), allOptions: optionValues(DAYS_FLEXIBILITY_OPTIONS),
  })
  const pace = fieldConsensus(participants, responses, 'pace', { labelMap: labelMapFrom(PACE_OPTIONS), allOptions: optionValues(PACE_OPTIONS) })
  const stay = fieldConsensus(participants, responses, 'stay_type', { labelMap: labelMapFrom(STAY_OPTIONS), allOptions: optionValues(STAY_OPTIONS) })
  const rooms = fieldConsensus(participants, responses, 'room_sharing', { labelMap: labelMapFrom(ROOM_OPTIONS), allOptions: optionValues(ROOM_OPTIONS) })
  const dealbreakers = fieldConsensus(participants, responses, 'dealbreakers', {
    allOptions: DEALBREAKERS, isMulti: true, noPrefField: 'no_dealbreakers',
  })
  return (
    <div className="space-y-4">
      <TripChecksCard checks={checks} />
      <Card className="p-5">
        <ConsensusRow label="Kind of trip" items={places} />
        <div className="h-px bg-neutral-100 my-4" />
        <ConsensusRow label="Starting point" items={startingPoints} />
        <div className="h-px bg-neutral-100 my-4" />
        <ConsensusRow label="Mode of transport" items={travelMode} />
        <div className="h-px bg-neutral-100 my-4" />
        <ConsensusRow label="Travel time" items={travelTime} />
        <div className="h-px bg-neutral-100 my-4" />
        <ConsensusRow label="Budget flexibility" items={budgetFlex} />
        <div className="h-px bg-neutral-100 my-4" />
        <ConsensusRow label="Trip-length flexibility" items={daysFlex} />
        <div className="h-px bg-neutral-100 my-4" />
        <ConsensusRow label="Pace" items={pace} />
        <div className="h-px bg-neutral-100 my-4" />
        <ConsensusRow label="Stay" items={stay} />
        <div className="h-px bg-neutral-100 my-4" />
        <ConsensusRow label="Rooms" items={rooms} />
        <div className="h-px bg-neutral-100 my-4" />
        <ConsensusRow label="Dealbreakers" items={dealbreakers} />
        <p className="text-[11px] text-neutral-400 mt-4">People who chose "no preference" aren't counted here — it's never treated as opposition.</p>
      </Card>
      <BudgetAndDatesCard participants={completed} responses={responses} />
    </div>
  )
}

function TripChecksCard({ checks }) {
  const rows = [
    { ok: checks.dateOk, label: 'Common travel window', okText: 'A date range exists that works for everyone (accounting for flexibility)', badText: 'No dates overlap for the whole group yet, even with flexibility' },
    { ok: checks.durationOk, label: 'Trip length', okText: 'No two people have non-overlapping fixed-availability day ranges', badText: 'At least two people have fixed (non-overlapping) day ranges — no length works for both' },
  ]
  return (
    <Card className="p-5">
      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-3">Trip-level checks</div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-2.5">
            <span className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${r.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <div>
              <div className="text-sm font-semibold text-neutral-800">{r.label}</div>
              <div className={`text-xs mt-0.5 ${r.ok ? 'text-neutral-500' : 'text-rose-600'}`}>{r.ok ? r.okText : r.badText}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-neutral-400 mt-3">These are group-wide gates — if any fails, no destinations can be recommended until it's resolved. A destination-level travel-time mismatch is different: it just removes that one destination, not the whole trip.</p>
    </Card>
  )
}

function BudgetAndDatesCard({ participants, responses }) {
  const band = computeBudgetBand(participants, responses)
  return (
    <Card className="p-5">
      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-3">Budget, per person</div>
      {band && (
        <p className="text-xs text-neutral-500 mb-4">
          Group's initial budget target: <span className="font-semibold text-neutral-700">₹{band.low.toLocaleString('en-IN')}–₹{band.high.toLocaleString('en-IN')}/person</span> — the lowest feasible band before anyone needs to use their stated flexibility. Destinations priced higher can still work if the pricier options' flexibility covers the gap.
        </p>
      )}
      <div className="space-y-2 mb-5">
        {participants.map((p) => {
          const r = responses[p.id]
          const scopeLabel = BUDGET_SCOPE_OPTIONS.find((o) => o.value === r.budget_includes_flights)?.label
          const flexLabel = BUDGET_FLEXIBILITY_OPTIONS.find((o) => o.value === r.budget_flexibility)?.label
          return (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-neutral-700">{p.name}</span>
              <span className="text-neutral-500 text-right">
                {r.budget_ceiling ? `₹${r.budget_ceiling.toLocaleString('en-IN')} (${scopeLabel}) · ${flexLabel}` : 'Not set'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-3">Dates, per person</div>
      <div className="space-y-2">
        {participants.map((p) => {
          const r = responses[p.id]
          const flexLabel = DATE_FLEXIBILITY_OPTIONS.find((o) => o.value === r.date_flexibility)?.label
          return (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-neutral-700">{p.name}</span>
              <span className="text-neutral-500 text-right">
                {r.date_range_start && r.date_range_end
                  ? `${r.date_range_start} to ${r.date_range_end} (${flexLabel})`
                  : r.date_range_start || r.date_range_end
                    ? `${r.date_range_start || r.date_range_end} onward (${flexLabel})`
                    : 'Not set'}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function ConflictsTab({ conflicts }) {
  if (conflicts.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-neutral-500">No major splits detected yet — your group is fairly aligned so far.</p>
      </Card>
    )
  }
  return (
    <div className="space-y-3">
      {conflicts.map((c) => (
        <Card key={c.type} className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <span className="font-bold text-neutral-900 text-sm">{c.title}</span>
          </div>
          <p className="text-sm text-neutral-600 mb-3">{c.description}</p>
          <div className="flex gap-3 flex-wrap">
            {c.groups.map((g) => (
              <div key={g.label} className="flex-1 min-w-[45%] bg-neutral-50 rounded-xl p-3">
                <div className="text-xs font-bold text-neutral-500 mb-1">{g.label}</div>
                <div className="text-xs text-neutral-700">{g.people.join(', ') || '—'}</div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

const CONFLICT_HEADINGS = {
  date: 'No common travel window yet',
  duration: 'No trip length works for everyone yet',
  travel: 'No destination reachable for everyone yet',
}

function OptionsTab({ optionsResult, counts, aiExplanations, aiStatus }) {
  const { dateConflict, conflictType, message, options } = optionsResult
  const [expanded, setExpanded] = useState(options[0]?.name || null)

  if (dateConflict) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={16} className="text-amber-500" />
          <span className="font-bold text-neutral-900 text-sm">{CONFLICT_HEADINGS[conflictType] || 'Not enough alignment yet'}</span>
        </div>
        <p className="text-sm text-neutral-600">{message}</p>
      </Card>
    )
  }
  if (options.length === 0) {
    return <Card className="p-5"><p className="text-sm text-neutral-400">Not enough data yet to generate options.</p></Card>
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">Your group is down to {options.length} option{options.length > 1 ? 's' : ''}. Based on {counts.completed} of {counts.total} responses.</p>
      {options.map((opt) => (
        <OptionCard
          key={opt.name}
          option={opt}
          isOpen={expanded === opt.name}
          onToggle={() => setExpanded(expanded === opt.name ? null : opt.name)}
          aiExplanation={aiExplanations[opt.name]}
          aiStatus={aiStatus}
        />
      ))}
    </div>
  )
}

function alignmentTone(alignment) {
  if (alignment === 'Strong alignment') return 'green'
  if (alignment === 'Partial alignment') return 'yellow'
  return 'red'
}

function OptionCard({ option, isOpen, onToggle, aiExplanation, aiStatus }) {
  const [personOpen, setPersonOpen] = useState(null)
  return (
    <Card className="p-5">
      <button onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <div>
          <div className="font-extrabold text-lg text-neutral-900 flex items-center gap-2">
            {option.name}
            {option.aiEstimated && <Pill tone="lagoon">AI-estimated</Pill>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Pill tone={alignmentTone(option.alignment)}>{option.alignment}</Pill>
            <span className="text-xs font-bold text-neutral-400">{option.groupFitScore}/100</span>
          </div>
        </div>
        {isOpen ? <ChevronUp className="text-neutral-400" /> : <ChevronDown className="text-neutral-400" />}
      </button>

      {isOpen && (
        <div className="mt-4 space-y-3">
          {aiExplanation ? (
            <div className="bg-lagoon-50 border border-lagoon-100 rounded-xl p-3">
              <div className="text-[10px] font-bold text-lagoon-600 uppercase tracking-wide mb-1">✨ AI summary</div>
              <p className="text-sm text-lagoon-800">{aiExplanation}</p>
            </div>
          ) : (
            <p className="text-sm text-neutral-600">{option.whyShortlisted}</p>
          )}
          {aiStatus === 'loading' && !aiExplanation && (
            <p className="text-xs text-neutral-400 italic">Generating an AI summary…</p>
          )}

          {option.bridgeNote && (
            <div className="bg-lagoon-50 border border-lagoon-200 rounded-xl p-3">
              <div className="text-[10px] font-bold text-lagoon-600 uppercase tracking-wide mb-1">Bridges a real conflict</div>
              <p className="text-sm text-lagoon-800">{option.bridgeNote}</p>
            </div>
          )}

          {option.sharedExperiences.length > 0 && (
            <div className="bg-lagoon-50 rounded-xl p-3">
              <ul className="space-y-1">
                {option.sharedExperiences.map((s) => (
                  <li key={s.experience} className="text-xs text-lagoon-800 flex items-start gap-1.5">
                    <span>✓</span><span><span className="font-medium">{s.experience}</span> — {s.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* One entry per person: a single always-visible status line (fit,
              compromise, block reason at a glance), tap to expand the full
              breakdown — replaces what used to be three separate,
              overlapping sections (per-person bullets, compromise balance,
              person-level fit) showing largely the same facts three ways. */}
          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Per person</div>
            <div className="space-y-1">
              {option.fits.map((f) => {
                const compromise = option.compromiseByPerson.find((c) => c.name === f.participant.name)?.compromise ?? 0
                const status = f.blocked
                  ? (f.reasons.find((r) => r.ok === false)?.text || 'Blocked')
                  : compromise === 0 ? 'At their personal best' : `Giving up ~${compromise}%`
                return (
                  <div key={f.participant.id}>
                    <button
                      onClick={() => setPersonOpen(personOpen === f.participant.id ? null : f.participant.id)}
                      className="w-full flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm text-neutral-700 flex items-center gap-1.5">
                        <span className="text-base leading-none">{f.level === 'green' ? '🟢' : f.level === 'yellow' ? '🟡' : '🔴'}</span>
                        {f.participant.name}
                      </span>
                      <span className={`text-xs ${f.blocked ? 'text-rose-600' : 'text-neutral-400'}`}>{status}</span>
                    </button>
                    {personOpen === f.participant.id && (
                      <div className="bg-neutral-50 rounded-xl p-3 mb-1 space-y-1">
                        {f.reasons.map((r, i) => (
                          <div key={i} className="text-xs text-neutral-600 flex items-start gap-1.5">
                            <span>{r.ok === true ? '✓' : r.ok === 'warn' ? '⚠️' : '✗'}</span>
                            <span>{r.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {option.fairnessNote && <p className="text-xs text-neutral-500 mt-1.5">{option.fairnessNote}</p>}
          </div>

          <details className="group">
            <summary className="text-xs font-bold text-neutral-400 uppercase tracking-wide cursor-pointer list-none flex items-center gap-1">
              Practical fit
              <ChevronDown size={12} className="group-open:hidden" />
              <ChevronUp size={12} className="hidden group-open:inline" />
            </summary>
            <ul className="space-y-0.5 mt-2">
              {option.practicalFit.map((p, i) => (
                <li key={i} className="text-xs text-neutral-600">• {p}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </Card>
  )
}

function DecideTab({ tripId, trip, options, participants, votes, participant, counts, onVoted }) {
  const votesByOption = useMemo(() => {
    const m = {}
    for (const opt of options) m[opt.name] = []
    for (const v of votes) {
      const p = participants.find((pp) => pp.id === v.participant_id)
      if (p && m[v.option_name]) m[v.option_name].push(p.name)
    }
    return m
  }, [votes, options, participants])

  const myVote = votes.find((v) => v.participant_id === participant.id)
  const isCoordinator = participant.isCoordinator
  const [finalizing, setFinalizing] = useState(false)

  async function vote(optionName) {
    await castVote(tripId, participant.id, optionName)
    onVoted()
  }

  async function finalize(optionName) {
    setFinalizing(true)
    await setTripStatus(tripId, 'decided', optionName)
    setFinalizing(false)
    onVoted()
  }

  if (options.length === 0) {
    return <Card className="p-5"><p className="text-sm text-neutral-400">No options generated yet.</p></Card>
  }

  if (trip.status === 'decided' && trip.final_destination) {
    return (
      <Card className="p-6 text-center">
        <div className="text-3xl mb-2">🎉</div>
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide">So, where are we going?</div>
        <div className="text-2xl font-extrabold text-neutral-900 mt-1">{trip.final_destination}</div>
      </Card>
    )
  }

  function shareOnWhatsApp() {
    const link = `${window.location.origin}/trip/${tripId}/results`
    const lines = options.map((opt) => {
      const n = (votesByOption[opt.name] || []).length
      return `${opt.name} — ${n} vote${n !== 1 ? 's' : ''}`
    })
    const text = `So, where are we going? 🎉\n\n${lines.join('\n')}\n\nCast your vote: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="space-y-3">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <VoteIcon size={16} className="text-lagoon-600" />
            <span className="font-bold text-neutral-900 text-sm">So, where are we going?</span>
          </div>
          <button
            onClick={shareOnWhatsApp}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold"
          >
            Share on WhatsApp
          </button>
        </div>
        <p className="text-xs text-neutral-400 mb-4">This tool shows the trade-offs — your group makes the final call. Cast your vote below.</p>
        <div className="space-y-2">
          {options.map((opt) => {
            const names = votesByOption[opt.name] || []
            const isMine = myVote?.option_name === opt.name
            return (
              <div key={opt.name} className={`rounded-2xl border p-4 ${isMine ? 'border-sunset-400 bg-sunset-50' : 'border-neutral-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-neutral-900">{opt.name}</div>
                    <div className="text-xs text-neutral-400">{names.length} vote{names.length !== 1 ? 's' : ''}{names.length ? `: ${names.join(', ')}` : ''}</div>
                  </div>
                  <Button size="sm" variant={isMine ? 'primary' : 'outline'} onClick={() => vote(opt.name)}>
                    {isMine ? 'Your vote' : 'Vote'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {isCoordinator && (
        <Card className="p-5">
          <div className="text-sm font-bold text-neutral-800 mb-1">Finalize the decision</div>
          <p className="text-xs text-neutral-400 mb-3">Lock in the group's choice once everyone has weighed in. Based on {counts.completed} of {counts.total} responses.</p>
          <div className="grid grid-cols-1 gap-2">
            {options.map((opt) => (
              <Button key={opt.name} variant="secondary" disabled={finalizing} onClick={() => finalize(opt.name)} className="w-full">
                Confirm {opt.name}
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
