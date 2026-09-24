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
  const myResponse = participant?.id ? responses[participant.id] : null
  const myStatus = myResponse?.status || 'not_started'

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
          <div className="flex items-center gap-3">
            {myStatus === 'completed' ? <CheckCircle2 className="text-emerald-500" size={28} /> : <Circle className="text-neutral-300" size={28} />}
            <div>
              <div className="font-bold text-neutral-900">
                {myStatus === 'completed' ? 'Your preferences are in' : myStatus === 'in_progress' ? 'You started, but haven’t finished' : "Don't forget your own preferences"}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {myStatus === 'completed' ? 'You can still edit them any time.' : "You're going on this trip too — takes about 2 minutes."}
              </div>
            </div>
          </div>
          <Button onClick={() => navigate(`/trip/${tripId}/preferences`)} className="w-full mt-4" size="lg">
            {myStatus === 'completed' ? 'Edit my preferences' : myStatus === 'in_progress' ? 'Continue' : 'Start'}
          </Button>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-bold text-neutral-800 mb-1">Invite your group</div>
          <p className="text-xs text-neutral-400 mb-3">Share this link with everyone going on the trip — invite as many people as you want.</p>
          <button onClick={copyLink} className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-sunset-500 text-white text-sm font-semibold">
            <span className="truncate">{copied ? 'Copied!' : 'Copy invite link'}</span>
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            onClick={() => navigate(`/trip/${tripId}/join`)}
            className="w-full mt-2 px-4 py-3 rounded-2xl border border-neutral-200 text-sm font-semibold text-neutral-700"
          >
            Add a person from this device
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
                  <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {!p.is_coordinator && (
                      <button
                        onClick={() => navigate(`/trip/${tripId}/preferences?as=${p.id}`)}
                        className="text-xs font-semibold text-sunset-500"
                      >
                        Edit
                      </button>
                    )}
                  </div>
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
