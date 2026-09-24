import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronUp, AlertTriangle, Vote as VoteIcon } from 'lucide-react'
import { Screen, TopBar, Button, Card, Pill } from '../components/ui'
import { getStoredParticipant } from '../lib/constants'
import { getTrip, getParticipants, getResponses, getVotes, castVote, subscribeToTrip, setTripStatus } from '../lib/api'
import { completionCounts, groupConsensus, computeConflicts, generateOptions } from '../lib/tripLogic'

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
  const options = useMemo(() => generateOptions(participants, responses, 3), [participants, responses])
  const conflicts = useMemo(() => computeConflicts(participants, responses), [participants, responses])

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
        {tab === 'Options' && <OptionsTab options={options} counts={counts} />}
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
          {items.slice(0, 6).map((it) => (
            <div key={it.option}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-neutral-800 font-medium">{it.option}</span>
                <span className="text-neutral-400">{it.count}/{it.total}</span>
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div className="h-full bg-sunset-500 rounded-full" style={{ width: `${(it.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ConsensusTab({ participants, responses }) {
  const destination = groupConsensus(participants, responses, 'destination_types', 'destination_no_pref')
  const activities = groupConsensus(participants, responses, 'activities', 'activities_no_pref')
  const vibes = groupConsensus(participants, responses, 'vibes', 'vibes_no_pref')
  return (
    <Card className="p-5">
      <ConsensusRow label="Destination type" items={destination} />
      <div className="h-px bg-neutral-100 my-4" />
      <ConsensusRow label="Activities" items={activities} />
      <div className="h-px bg-neutral-100 my-4" />
      <ConsensusRow label="Trip vibe" items={vibes} />
      <p className="text-[11px] text-neutral-400 mt-4">People who chose "no preference" aren't counted here — it's never treated as opposition.</p>
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

function OptionsTab({ options, counts }) {
  const [expanded, setExpanded] = useState(options[0]?.name || null)
  if (options.length === 0) {
    return <Card className="p-5"><p className="text-sm text-neutral-400">Not enough data yet to generate options.</p></Card>
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-400">Your group is down to {options.length} option{options.length > 1 ? 's' : ''}. Based on {counts.completed} of {counts.total} responses.</p>
      {options.map((opt) => (
        <OptionCard key={opt.name} option={opt} isOpen={expanded === opt.name} onToggle={() => setExpanded(expanded === opt.name ? null : opt.name)} />
      ))}
    </div>
  )
}

function alignmentTone(alignment) {
  if (alignment === 'Strong alignment') return 'green'
  if (alignment === 'Partial alignment') return 'yellow'
  return 'red'
}

function OptionCard({ option, isOpen, onToggle }) {
  const [personOpen, setPersonOpen] = useState(null)
  return (
    <Card className="p-5">
      <button onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <div>
          <div className="font-extrabold text-lg text-neutral-900">{option.name}</div>
          <Pill tone={alignmentTone(option.alignment)} className="mt-1">{option.alignment}</Pill>
        </div>
        {isOpen ? <ChevronUp className="text-neutral-400" /> : <ChevronDown className="text-neutral-400" />}
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4">
          {option.strengths.length > 0 && (
            <div>
              {option.strengths.map((s) => (
                <div key={s} className="text-sm text-emerald-700 flex items-start gap-1.5 mb-1">
                  <span>✓</span><span>{s}</span>
                </div>
              ))}
            </div>
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

          {option.compromiseNotes.length > 0 && (
            <div>
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-1">Potential compromise</div>
              {option.compromiseNotes.map((n) => <p key={n} className="text-sm text-neutral-600">{n}</p>)}
            </div>
          )}

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
