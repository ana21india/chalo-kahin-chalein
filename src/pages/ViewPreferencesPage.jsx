import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Screen, TopBar, Button, Card } from '../components/ui'
import { getStoredParticipant } from '../lib/constants'
import { getTrip, getParticipant, getResponse } from '../lib/api'
import {
  BUDGET_SCOPE_OPTIONS, BUDGET_FLEXIBILITY_OPTIONS,
  DAYS_FLEXIBILITY_OPTIONS, TRAVEL_TIME_FIRMNESS_OPTIONS, TRAVEL_TIME_OPTIONS, PACE_OPTIONS,
  STAY_OPTIONS, ROOM_OPTIONS,
} from '../lib/constants'

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label
}

// Read-only summary of a participant's submitted preferences — this page
// never lets you change anything. "Edit" is a deliberate, separate action
// (a button at the bottom), never something View silently doubles as.
export default function ViewPreferencesPage() {
  const { tripId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const viewer = getStoredParticipant(tripId)
  const targetId = searchParams.get('as') || viewer?.id

  const [trip, setTrip] = useState(null)
  const [target, setTarget] = useState(null)
  const [response, setResponse] = useState(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    if (!viewer?.id || !targetId) {
      navigate(`/trip/${tripId}`, { replace: true })
      return
    }
    // Only the coordinator can view someone else's answers; anyone can view their own.
    if (targetId !== viewer.id && !viewer.isCoordinator) {
      setDenied(true)
      return
    }
    Promise.all([getTrip(tripId), getParticipant(targetId), getResponse(targetId)]).then(([t, p, r]) => {
      setTrip(t)
      setTarget(p)
      setResponse(r)
    })
  }, [tripId, targetId])

  if (denied) {
    return (
      <Screen>
        <TopBar title="Can't view this" onBack={() => navigate(-1)} />
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-sm text-neutral-500">Only the coordinator can view someone else's preferences.</p>
        </div>
      </Screen>
    )
  }

  if (!trip || !target) {
    return <Screen><div className="flex-1 flex items-center justify-center"><p className="text-sm text-neutral-400">Loading…</p></div></Screen>
  }

  if (!response || response.status === 'not_started') {
    return (
      <Screen>
        <TopBar title={`${target.name}'s preferences`} subtitle={trip.name} onBack={() => navigate(-1)} />
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-sm text-neutral-500">{target.name} hasn't started filling this out yet.</p>
        </div>
      </Screen>
    )
  }

  const budgetScopeLabel = labelFor(BUDGET_SCOPE_OPTIONS, response.budget_includes_flights)
  const budgetFlexLabel = labelFor(BUDGET_FLEXIBILITY_OPTIONS, response.budget_flexibility)
  const daysFlexLabel = labelFor(DAYS_FLEXIBILITY_OPTIONS, response.days_flexibility)
  const travelTimeLabel = labelFor(TRAVEL_TIME_OPTIONS, response.travel_time_max)
  const travelTimeFirmnessLabel = labelFor(TRAVEL_TIME_FIRMNESS_OPTIONS, response.travel_time_firmness)
  const paceLabel = labelFor(PACE_OPTIONS, response.pace)
  const stayLabel = labelFor(STAY_OPTIONS, response.stay_type)
  const roomLabel = labelFor(ROOM_OPTIONS, response.room_sharing)

  const canEdit = viewer.isCoordinator || targetId === viewer.id

  return (
    <Screen>
      <TopBar title={`${target.name}'s preferences`} subtitle={response.status === 'in_progress' ? 'Still in progress — showing what\'s saved so far' : trip.name} onBack={() => navigate(-1)} />
      <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto pb-10">
        <ViewCard title="Kind of trip">
          {response.destination_no_pref ? 'No preference' : ((response.destination_types || []).join(', ') || 'Nothing selected')}
        </ViewCard>

        <ViewCard title="Budget">
          {response.budget_ceiling ? `Max ₹${response.budget_ceiling.toLocaleString('en-IN')} (${budgetScopeLabel}) · ${budgetFlexLabel}` : 'Not set'}
        </ViewCard>

        <ViewCard title="Dates & duration">
          {response.date_range_start && response.date_range_end ? `${response.date_range_start} to ${response.date_range_end}` : 'Flexible'}
          {response.min_days || response.max_days ? ` · ${response.min_days || '?'}–${response.max_days || '?'} days (${daysFlexLabel})` : ''}
        </ViewCard>

        <ViewCard title="Starting point">
          {response.starting_city || 'City not set'} · {response.travel_mode || 'Anything'} · {travelTimeLabel}
          {response.travel_time_max && response.travel_time_max !== 'no_limit' ? ` (${travelTimeFirmnessLabel})` : ''}
        </ViewCard>

        <ViewCard title="Pace & stay">
          {[paceLabel, stayLabel, roomLabel].filter(Boolean).join(' · ') || 'Not set'}
        </ViewCard>

        <ViewCard title="Dealbreakers">
          {response.no_dealbreakers || (response.dealbreakers || []).length === 0 ? 'None' : response.dealbreakers.join(', ')}
        </ViewCard>

        {canEdit && (
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={() => navigate(targetId === viewer.id ? `/trip/${tripId}/preferences` : `/trip/${tripId}/preferences?as=${targetId}`)}
          >
            Edit these preferences
          </Button>
        )}
      </div>
    </Screen>
  )
}

function ViewCard({ title, children }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">{title}</div>
      <p className="text-sm text-neutral-800">{children}</p>
    </Card>
  )
}
