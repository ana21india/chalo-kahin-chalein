import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, Check, CheckCircle2, Clock, Circle } from 'lucide-react'
import { Screen, TopBar, Button, Card, Pill } from '../components/ui'
import { getStoredParticipant } from '../lib/constants'
import { getTrip, getParticipants, getResponses, subscribeToTrip } from '../lib/api'
import { completionCounts } from '../lib/tripLogic'

export default function CoordinatorDashboardPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const participant = getStoredParticipant(tripId)
  const [trip, setTrip] = useState(null)
  const [participants, setParticipants] = useState([])
  const [responses, setResponses] = useState({})
  const [copied, setCopied] = useState(false)

  async function load() {
    const [t, ps, rs] = await Promise.all([getTrip(tripId), getParticipants(tripId), getResponses(tripId)])
    setTrip(t)
    setParticipants(ps)
    const byId = {}
    rs.forEach((r) => { byId[r.participant_id] = r })
    setResponses(byId)
  }

  useEffect(() => {
    if (!participant?.isCoordinator) {
      navigate(`/trip/${tripId}`, { replace: true })
      return
    }
    load()
    const unsub = subscribeToTrip(tripId, load)
    return unsub
  }, [tripId])

  if (!trip) {
    return <Screen><div className="flex-1 flex items-center justify-center"><p className="text-sm text-neutral-400">Loading…</p></div></Screen>
  }

  const counts = completionCounts(participants, responses)
  const inviteLink = `${window.location.origin}/trip/${tripId}`

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Screen>
      <TopBar title={trip.name} subtitle={`Created by ${trip.coordinator_name}`} />
      <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto pb-10">
        <Card className="p-5">
          <div className="text-sm font-bold text-neutral-800 mb-1">Invite your group</div>
          <p className="text-xs text-neutral-400 mb-3">Share this link with everyone going on the trip.</p>
          <button onClick={copyLink} className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-sunset-500 text-white text-sm font-semibold">
            <span className="truncate">{copied ? 'Copied!' : 'Copy invite link'}</span>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-neutral-800">Trip status</span>
            <Pill tone="sunset">{counts.completed} / {counts.total} submitted</Pill>
          </div>
          <div className="space-y-2">
            {participants.map((p) => {
              const r = responses[p.id]
              const status = r?.status || 'not_started'
              return (
                <div key={p.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-neutral-700 flex items-center gap-1.5">
                    {p.name}
                    {p.is_coordinator && <span className="text-[10px] text-sunset-500 font-bold uppercase">You</span>}
                  </span>
                  <StatusBadge status={status} />
                </div>
              )
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-bold text-neutral-800 mb-2">What does our group want?</div>
          {counts.completed < 2 ? (
            <p className="text-sm text-neutral-400 mb-1">
              Results unlock once at least 2 people submit. Right now {counts.completed} of {counts.total} have responded.
            </p>
          ) : counts.completed < counts.total ? (
            <p className="text-sm text-neutral-400 mb-3">
              Based on {counts.completed} of {counts.total} responses so far — not everyone has submitted yet.
            </p>
          ) : (
            <p className="text-sm text-neutral-400 mb-3">Everyone has responded. Ready to see the full picture.</p>
          )}
          <Button
            variant="secondary"
            onClick={() => navigate(`/trip/${tripId}/results`)}
            disabled={counts.completed < 2}
            className="w-full"
          >
            View results
          </Button>
        </Card>
      </div>
    </Screen>
  )
}

function StatusBadge({ status }) {
  if (status === 'completed') return <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 size={14} /> Completed</span>
  if (status === 'in_progress') return <span className="flex items-center gap-1 text-xs font-semibold text-amber-600"><Clock size={14} /> In progress</span>
  return <span className="flex items-center gap-1 text-xs font-semibold text-neutral-400"><Circle size={14} /> Not started</span>
}
