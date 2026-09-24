import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { Screen, Button, TextInput, Card } from '../components/ui'
import { getStoredParticipant, storeParticipant } from '../lib/constants'
import { getTrip, joinTrip } from '../lib/api'

// This page is an explicit "join" entry point — it always shows the name
// form, even if this browser already has a stored identity for the trip
// (e.g. the coordinator adding several people from their own device).
// Submitting overwrites this browser's stored identity with the new person.
export default function JoinTripPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getTrip(tripId)
      .then(setTrip)
      .catch(() => setError("We couldn't find that trip."))
      .finally(() => setLoading(false))
  }, [tripId])

  async function handleContinue() {
    if (!name.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const participant = await joinTrip(tripId, name.trim())
      const existing = getStoredParticipant(tripId)
      if (existing?.isCoordinator) {
        // The coordinator is adding someone else from their own device —
        // keep their own identity intact and let them fill in the new
        // person's preferences on their behalf instead.
        navigate(`/trip/${tripId}/preferences?as=${participant.id}`)
      } else {
        storeParticipant(tripId, { id: participant.id, name: participant.name, isCoordinator: false })
        navigate(`/trip/${tripId}/preferences`)
      }
    } catch (e) {
      console.error(e)
      setError('Something went wrong joining this trip. Try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Screen>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-neutral-400">Loading…</p>
        </div>
      </Screen>
    )
  }

  if (error && !trip) {
    return (
      <Screen>
        <div className="flex-1 flex items-center justify-center px-8 text-center">
          <p className="text-sm text-neutral-500">{error}</p>
        </div>
      </Screen>
    )
  }

  return (
    <Screen>
      <div className="flex-1 flex flex-col justify-center px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sunset-400 to-sunset-600 shadow-soft mb-4">
            <MapPin className="text-white" size={26} />
          </div>
          <p className="text-xs text-neutral-400 font-medium">You're joining</p>
          <h1 className="text-2xl font-extrabold text-neutral-900 mt-1">{trip.name}</h1>
          <p className="text-sm text-neutral-500 mt-1">Created by {trip.coordinator_name}</p>
        </div>

        <Card className="p-5 space-y-4">
          <div>
            <div className="text-sm font-bold text-neutral-800 mb-2.5">What's your name?</div>
            <TextInput value={name} onChange={setName} placeholder="Enter your name" onKeyDown={(e) => e.key === 'Enter' && handleContinue()} />
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <Button onClick={handleContinue} disabled={!name.trim() || submitting} className="w-full" size="lg">
            {submitting ? 'Joining…' : 'Continue'}
          </Button>
        </Card>
      </div>
    </Screen>
  )
}
