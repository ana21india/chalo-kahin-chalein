import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, TopBar, Button, TextInput } from '../components/ui'
import { storeParticipant } from '../lib/constants'
import { createTrip } from '../lib/api'

export default function CreateTripPage() {
  const navigate = useNavigate()
  const [coordinatorName, setCoordinatorName] = useState('')
  const [tripName, setTripName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = coordinatorName.trim() && tripName.trim() && !submitting

  async function handleCreate() {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      const { trip, participant } = await createTrip({
        coordinatorName: coordinatorName.trim(),
        tripName: tripName.trim(),
      })
      storeParticipant(trip.id, { id: participant.id, name: participant.name, isCoordinator: true })
      navigate(`/trip/${trip.id}/dashboard`)
    } catch (e) {
      console.error(e)
      setError('Something went wrong creating your trip. Check your Supabase setup and try again.')
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <TopBar title="Create a trip" subtitle="A few basics to get your group started." onBack={() => navigate('/')} />
      <div className="flex-1 px-5 py-4 space-y-5 overflow-y-auto pb-28">
        <Field label="Who is coordinating this trip?">
          <TextInput value={coordinatorName} onChange={setCoordinatorName} placeholder="Your name" />
        </Field>

        <Field label="What should we call this trip?" hint="e.g. Goa 2026, Thailand Trip, College Reunion">
          <TextInput value={tripName} onChange={setTripName} placeholder="Trip name" onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
        </Field>

        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>

      <div className="px-5 py-4 border-t border-neutral-100 bg-cream relative z-10">
        <Button onClick={handleCreate} disabled={!canSubmit} className="w-full" size="lg">
          {submitting ? 'Creating…' : 'Create Trip'}
        </Button>
      </div>
    </Screen>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="mb-2.5">
        <div className="text-sm font-bold text-neutral-800">{label}</div>
        {hint && <div className="text-xs text-neutral-400 mt-0.5">{hint}</div>}
      </div>
      {children}
    </div>
  )
}
