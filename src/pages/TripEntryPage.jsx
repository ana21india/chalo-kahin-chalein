import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Screen } from '../components/ui'
import { getStoredParticipant } from '../lib/constants'
import { getTrip } from '../lib/api'

export default function TripEntryPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        await getTrip(tripId)
        if (cancelled) return
        const stored = getStoredParticipant(tripId)
        if (stored?.isCoordinator) {
          navigate(`/trip/${tripId}/dashboard`, { replace: true })
        } else if (stored?.id) {
          navigate(`/trip/${tripId}/status`, { replace: true })
        } else {
          navigate(`/trip/${tripId}/join`, { replace: true })
        }
      } catch (e) {
        if (!cancelled) setError("We couldn't find that trip. Double-check the invite link.")
      }
    }
    run()
    return () => { cancelled = true }
  }, [tripId, navigate])

  return (
    <Screen>
      <div className="flex-1 flex items-center justify-center px-8 text-center">
        {error ? (
          <p className="text-sm text-neutral-500">{error}</p>
        ) : (
          <p className="text-sm text-neutral-400">Loading trip…</p>
        )}
      </div>
    </Screen>
  )
}
