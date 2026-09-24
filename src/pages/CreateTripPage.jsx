import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Screen, TopBar, Button, TextInput, Card } from '../components/ui'
import { DURATION_OPTIONS, DATES_TYPE_OPTIONS, storeParticipant } from '../lib/constants'
import { createTrip } from '../lib/api'

export default function CreateTripPage() {
  const navigate = useNavigate()
  const [coordinatorName, setCoordinatorName] = useState('')
  const [tripName, setTripName] = useState('')
  const [initialDestination, setInitialDestination] = useState('')
  const [datesType, setDatesType] = useState('flexible')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [dateMonth, setDateMonth] = useState('')
  const [duration, setDuration] = useState('Not decided')
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
        initialDestination: initialDestination.trim(),
        datesType,
        dateStart,
        dateEnd,
        dateMonth,
        duration,
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
          <TextInput value={tripName} onChange={setTripName} placeholder="Trip name" />
        </Field>

        <Field label="Where are you thinking of going?" hint="Optional — just a starting point, not the final call.">
          <TextInput value={initialDestination} onChange={setInitialDestination} placeholder="e.g. Goa, Bali, Anywhere, Not decided" />
        </Field>

        <Field label="Approximate dates">
          <div className="grid grid-cols-2 gap-2">
            {DATES_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDatesType(opt.value)}
                className={`px-3 py-3 rounded-xl2 text-sm font-medium border text-left ${datesType === opt.value ? 'bg-sunset-500 border-sunset-500 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {datesType === 'specific' || datesType === 'range' ? (
            <div className="flex gap-2 mt-3">
              <TextInput type="date" value={dateStart} onChange={setDateStart} />
              <TextInput type="date" value={dateEnd} onChange={setDateEnd} />
            </div>
          ) : null}
          {datesType === 'month' ? (
            <div className="mt-3">
              <TextInput value={dateMonth} onChange={setDateMonth} placeholder="e.g. December 2026" />
            </div>
          ) : null}
        </Field>

        <Field label="Approximate trip duration">
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`px-4 py-2.5 rounded-full text-sm font-medium border ${duration === d ? 'bg-lagoon-600 border-lagoon-600 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>

        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>

      <div className="px-5 py-4 border-t border-neutral-100 bg-[#fbf8f4]">
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
