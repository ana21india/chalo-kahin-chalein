import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, AlertTriangle, Vote as VoteIcon } from 'lucide-react'
import { Screen, TopBar, Button, Card, Pill } from '../components/ui'
import { getStoredParticipant } from '../lib/constants'
import { getTrip, getParticipants, getResponses, getVotes, castVote, subscribeToTrip, setTripStatus } from '../lib/api'
import { completionCounts, fieldConsensus, computeConflicts, generateOptions, tripLevelChecks } from '../lib/tripLogic'
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
  const optionsResult = useMemo(() => generateOptions(participants, responses, 3), [participants, responses])
  const options = optionsResult.options
  const conflicts = useMemo(() => computeConflicts(participants, responses), [participants, responses])

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
  const max = items[0]?.count || 1
  return (
    <div className="mb-5 last:mb-0">
      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">{label}</div>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">No preferences expressed yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.option}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-neutral-800 font-medium">{it.option}</span>
                <span className="text-neutral-400">{it.count}/{it.total}</span>
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div className="h-full bg-sunset-500 rounded-full" style={{ width: `${(it.count / max) * 100}%` }} />
              </div>
              {it.people && it.people.length > 0 && (
                <div className="text-[11px] text-neutral-400 mt-1">
                  {it.people.map((p) => (p.detail ? `${p.name} (${p.detail})` : p.name)).join(', ')}
                </div>
              )}
            </div>
          ))}
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
  return (
    <Card className="p-5">
      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-3">Budget, per person</div>
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
                {r.date_range_start && r.date_range_end ? `${r.date_range_start} to ${r.date_range_end} (${flexLabel})` : 'Flexible / not set'}
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
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Pill tone={alignmentTone(option.alignment)}>{option.alignment}</Pill>
            <span className="text-xs font-bold text-neutral-400">{option.groupFitScore}/100</span>
          </div>
        </div>
        {isOpen ? <ChevronUp className="text-neutral-400" /> : <ChevronDown className="text-neutral-400" />}
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-neutral-600">{option.whyShortlisted}</p>

          {aiExplanation && (
            <div className="bg-lagoon-50 border border-lagoon-100 rounded-xl p-3">
              <div className="text-[10px] font-bold text-lagoon-600 uppercase tracking-wide mb-1">✨ AI summary</div>
              <p className="text-sm text-lagoon-800">{aiExplanation}</p>
            </div>
          )}
          {aiStatus === 'loading' && !aiExplanation && (
            <p className="text-xs text-neutral-400 italic">Generating an AI summary…</p>
          )}

          {option.whoBlocked.length > 0 && (
            <div className="bg-rose-50 rounded-xl p-3">
              <div className="text-xs font-bold text-rose-600 mb-1">Doesn't currently work for</div>
              <p className="text-sm text-rose-700">{option.whoBlocked.join(', ')}</p>
            </div>
          )}

          {option.whoCompromises.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3">
              <div className="text-xs font-bold text-amber-600 mb-1">Needs a small compromise from</div>
              <p className="text-sm text-amber-700">{option.whoCompromises.join(', ')}</p>
            </div>
          )}

          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Why it works, person by person</div>
            <div className="space-y-3">
              {option.perTraveller.map((t) => (
                <div key={t.name}>
                  <div className="text-sm font-bold text-neutral-800 mb-1">{t.name}</div>
                  <ul className="space-y-0.5">
                    {t.bullets.map((b, i) => (
                      <li key={i} className="text-xs text-neutral-600 flex items-start gap-1.5">
                        <span>{b.strong === false ? '⚠️' : '✓'}</span>
                        <span><span className="font-medium">{b.preference}</span> → {b.matches}</span>
                      </li>
                    ))}
                    {t.blocked && t.blockReasons.map((r, i) => (
                      <li key={`b${i}`} className="text-xs text-rose-600 flex items-start gap-1.5">
                        <span>✗</span><span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {option.sharedExperiences.length > 0 && (
            <div>
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Shared experiences</div>
              <ul className="space-y-1">
                {option.sharedExperiences.map((s) => (
                  <li key={s.experience} className="text-xs text-lagoon-700 flex items-start gap-1.5">
                    <span>✓</span><span><span className="font-medium">{s.experience}</span> — {s.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Practical fit</div>
            <ul className="space-y-0.5">
              {option.practicalFit.map((p, i) => (
                <li key={i} className="text-xs text-neutral-600">• {p}</li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Person-level fit</div>
            <div className="space-y-1.5">
              {option.fits.map((f) => (
                <div key={f.participant.id}>
                  <button
                    onClick={() => setPersonOpen(personOpen === f.participant.id ? null : f.participant.id)}
                    className="w-full flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-neutral-700">{f.participant.name}</span>
                    <span className="text-lg leading-none">{f.level === 'green' ? '🟢' : f.level === 'yellow' ? '🟡' : '🔴'}</span>
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
              ))}
            </div>
          </div>
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

  return (
    <div className="space-y-3">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <VoteIcon size={16} className="text-lagoon-600" />
          <span className="font-bold text-neutral-900 text-sm">So, where are we going?</span>
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
