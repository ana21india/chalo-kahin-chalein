import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Circle, Copy, Check, LayoutDashboard } from 'lucide-react'
import { Screen, TopBar, Button, Card, Pill } from '../components/ui'
import { getStoredParticipant } from '../lib/constants'
import { getTrip, getParticipants, getResponses, subscribeToTrip } from '../lib/api'
import { completionCounts } from '../lib/tripLogic'

export default function ParticipantStatusPage() {
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
    if (!participant?.id) {
      navigate(`/trip/${tripId}/join`, { replace: true })
      return
    }
    load()
    const unsub = subscribeToTrip(tripId, load)
    return unsub
  }, [tripId])

  if (!trip) {
    return <Screen><div className="flex-1 flex items-center justify-center"><p className="text-sm text-neutral-400">Loading…</p></div></Screen>
  }

  const myResponse = responses[participant.id]
  const myStatus = myResponse?.status || 'not_started'
  const counts = completionCounts(participants, responses)
  const inviteLink = `${window.location.origin}/trip/${tripId}`

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Screen>
      <TopBar
        title={trip.name}
        subtitle={`Created by ${trip.coordinator_name}`}
        action={participant.isCoordinator && (
          <button
            onClick={() => navigate(`/trip/${tripId}/dashboard`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold"
          >
            <LayoutDashboard size={14} /> Dashboard
          </button>
        )}
      />
      <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto pb-10">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            {myStatus === 'completed' ? <CheckCircle2 className="text-emerald-500" size={28} /> : <Circle className="text-neutral-300" size={28} />}
            <div>
              <div className="font-bold text-neutral-900">
                {myStatus === 'completed' ? 'You’re all set' : myStatus === 'in_progress' ? 'You started, but haven’t finished' : 'You haven’t submitted yet'}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {myStatus === 'completed' ? 'Submitted — ask your coordinator if you need to change anything.' : 'Takes about 2 minutes.'}
              </div>
            </div>
          </div>
          {myStatus !== 'completed' && (
            <Button onClick={() => navigate(`/trip/${tripId}/preferences`)} className="w-full mt-4" size="lg">
              {myStatus === 'in_progress' ? 'Continue' : 'Start'}
            </Button>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-neutral-800">Group progress</span>
            <Pill tone="sunset">{counts.completed} / {counts.total} submitted</Pill>
          </div>
          <p className="text-xs text-neutral-400 mb-3">Invite anyone still missing from the group.</p>
          <button onClick={copyLink} className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-neutral-50 border border-neutral-200 text-sm text-neutral-600">
            <span className="truncate">{inviteLink}</span>
            {copied ? <Check size={16} className="text-emerald-500 shrink-0" /> : <Copy size={16} className="text-neutral-400 shrink-0" />}
          </button>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-bold text-neutral-800 mb-3">Group results</div>
          {counts.completed < 2 ? (
            <p className="text-sm text-neutral-400">Results unlock once at least 2 people submit their preferences.</p>
          ) : (
            <Button variant="secondary" onClick={() => navigate(`/trip/${tripId}/results`)} className="w-full">
              View results ({counts.completed} of {counts.total} responses)
            </Button>
          )}
        </Card>
      </div>
    </Screen>
  )
}
