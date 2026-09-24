import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, X, Plus } from 'lucide-react'
import { Screen, TopBar, Button, Card, TextInput, ProgressDots } from '../components/ui'
import ChipSelect from '../components/ChipSelect'
import {
  TRIP_SCOPE_OPTIONS, TRIP_TYPE_OPTIONS_BY_SCOPE, DEALBREAKERS, BUDGET_SCOPE_OPTIONS,
  PACE_OPTIONS, STAY_OPTIONS, ROOM_OPTIONS, TRAVEL_MODES, TRAVEL_TIME_OPTIONS,
  DATE_FLEXIBILITY_OPTIONS, MAJOR_CITIES, getStoredParticipant,
} from '../lib/constants'
import { DESTINATIONS } from '../lib/destinations'
import { getTrip, getResponse, upsertResponse } from '../lib/api'

const STEPS = ['tripScope', 'destinationPick', 'budget', 'datesAndDuration', 'startingPoint', 'tripType', 'paceAndStay', 'dealbreakers', 'review']

const INTEGER_FIELDS = ['budget_ceiling', 'min_days', 'max_days']
const DATE_FIELDS = ['date_range_start', 'date_range_end']

function sanitizeForm(form) {
  const out = { ...form }
  for (const key of INTEGER_FIELDS) {
    const v = out[key]
    out[key] = v === '' || v === null || v === undefined ? null : parseInt(v, 10)
  }
  for (const key of DATE_FIELDS) {
    if (out[key] === '') out[key] = null
  }
  return out
}

const emptyForm = {
  trip_scope: 'either',
  specific_destinations: [], no_specific_destination: false,
  budget_ceiling: '', budget_includes_flights: 'whole_trip',
  date_range_start: '', date_range_end: '', date_flexibility: 'flexible', min_days: '', max_days: '',
  starting_city: '', travel_mode: 'Anything', travel_time_max: 'no_limit',
  destination_types: [], destination_no_pref: false,
  pace: '', stay_type: '', room_sharing: '',
  dealbreakers: [], no_dealbreakers: false,
}

export default function PreferenceFlowPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const participant = getStoredParticipant(tripId)

  const [trip, setTrip] = useState(null)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!participant?.id) {
      navigate(`/trip/${tripId}/join`, { replace: true })
      return
    }
    Promise.all([getTrip(tripId), getResponse(participant.id)]).then(([t, r]) => {
      setTrip(t)
      if (r) {
        const loaded = { ...emptyForm, ...r }
        for (const key of INTEGER_FIELDS) if (loaded[key] === null || loaded[key] === undefined) loaded[key] = ''
        for (const key of DATE_FIELDS) if (loaded[key] === null || loaded[key] === undefined) loaded[key] = ''
        if (!loaded.pace) loaded.pace = ''
        if (!loaded.stay_type) loaded.stay_type = ''
        if (!loaded.room_sharing) loaded.room_sharing = ''
        if (!loaded.starting_city) loaded.starting_city = ''
        setForm(loaded)
      }
      setLoading(false)
    })
  }, [tripId])

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }))
  }

  async function persist(status) {
    setSaving(true)
    try {
      await upsertResponse(tripId, participant.id, { ...sanitizeForm(form), status: status || 'in_progress' })
    } finally {
      setSaving(false)
    }
  }

  async function goNext() {
    await persist('in_progress')
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  function goBack() {
    if (step === 0) { navigate(-1); return }
    setStep((s) => Math.max(s - 1, 0))
  }

  async function handleSubmit() {
    await persist('completed')
    navigate(`/trip/${tripId}/status`)
  }

  if (loading || !trip) {
    return (
      <Screen>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-neutral-400">Loading…</p>
        </div>
      </Screen>
    )
  }

  const current = STEPS[step]

  return (
    <Screen>
      <TopBar onBack={goBack} />
      <ProgressDots step={step} total={STEPS.length} />
      <div className="flex-1 px-5 pt-5 pb-28 overflow-y-auto">
        {current === 'tripScope' && (
          <TripScopePhase value={form.trip_scope} onChange={(v) => set({ trip_scope: v })} />
        )}
        {current === 'destinationPick' && (
          <DestinationPickPhase
            trip={trip}
            scope={form.trip_scope}
            values={form.specific_destinations}
            noSpecific={form.no_specific_destination}
            onValuesChange={(v) => set({ specific_destinations: v })}
            onNoSpecificChange={(v) => set({ no_specific_destination: v, specific_destinations: v ? [] : form.specific_destinations })}
          />
        )}
        {current === 'budget' && <BudgetPhase form={form} set={set} />}
        {current === 'datesAndDuration' && <DatesPhase form={form} set={set} />}
        {current === 'startingPoint' && <StartingPointPhase form={form} set={set} />}
        {current === 'tripType' && (
          <div>
            <PhaseHeader
              title="What kind of trip is it?"
              subtitle={form.trip_scope === 'either' ? 'Pick up to 2.' : `Options for a ${form.trip_scope} trip. Pick up to 2.`}
            />
            <ChipSelect
              options={TRIP_TYPE_OPTIONS_BY_SCOPE[form.trip_scope] || TRIP_TYPE_OPTIONS_BY_SCOPE.either}
              selected={form.destination_types}
              onChange={(v) => set({ destination_types: v })}
              noPreference={form.destination_no_pref}
              onNoPreferenceChange={(v) => set({ destination_no_pref: v, destination_types: v ? [] : form.destination_types })}
              max={2}
              allowCustom={false}
            />
          </div>
        )}
        {current === 'paceAndStay' && <PaceAndStayPhase form={form} set={set} />}
        {current === 'dealbreakers' && <DealbreakersPhase form={form} set={set} />}
        {current === 'review' && <ReviewPhase form={form} onEdit={(i) => setStep(i)} />}
      </div>

      <div className="px-5 py-4 border-t border-neutral-100 bg-[#fbf8f4] flex gap-2">
        {current === 'review' ? (
          <Button onClick={handleSubmit} className="w-full" size="lg" disabled={saving}>
            Submit my preferences
          </Button>
        ) : (
          <Button onClick={goNext} className="w-full" size="lg" disabled={saving}>
            Continue
          </Button>
        )}
      </div>
    </Screen>
  )
}

function PhaseHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-extrabold text-neutral-900 leading-snug">{title}</h2>
      {subtitle && <p className="text-sm text-neutral-500 mt-1.5">{subtitle}</p>}
    </div>
  )
}

function TripScopePhase({ value, onChange }) {
  return (
    <div>
      <PhaseHeader title="National or international?" subtitle="Assuming everyone's passport/visa situation is sorted." />
      <div className="flex flex-col gap-2">
        {TRIP_SCOPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-3.5 rounded-2xl text-left border transition-colors flex items-center justify-between
              ${value === opt.value ? 'bg-sunset-500 border-sunset-500 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
          >
            <span className="font-semibold text-sm">{opt.label}</span>
            <span className={`text-xs ${value === opt.value ? 'text-white/80' : 'text-neutral-400'}`}>{opt.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function DestinationPickPhase({ trip, scope, values, noSpecific, onValuesChange, onNoSpecificChange }) {
  const [input, setInput] = useState('')

  const suggestions = useMemo(() => {
    const pool = DESTINATIONS.filter((d) => {
      if (scope === 'national') return d.domestic
      if (scope === 'international') return !d.domestic
      return true
    })
    return pool.slice(0, 10).map((d) => d.name)
  }, [scope])

  function add(name) {
    const v = (name ?? input).trim()
    if (!v || values.length >= 3 || noSpecific) return
    if (!values.includes(v)) onValuesChange([...values, v])
    if (!name) setInput('')
  }
  function remove(v) {
    onValuesChange(values.filter((x) => x !== v))
  }

  return (
    <div>
      <PhaseHeader
        title="Any places in mind?"
        subtitle={
          scope === 'national' ? 'Popular picks within India, based on what you just chose. Up to 3.'
          : scope === 'international' ? 'Popular picks abroad, based on what you just chose. Up to 3.'
          : 'Up to 3 places. Totally optional.'
        }
      />

      {trip?.initial_destination && trip.initial_destination.toLowerCase() !== 'not decided yet' && (
        <Card className="p-4 mb-4 bg-sunset-50 border-sunset-100">
          <p className="text-sm text-neutral-700">
            Your coordinator suggested <span className="font-bold">{trip.initial_destination}</span>.
          </p>
          <button
            onClick={() => add(trip.initial_destination)}
            className="mt-2 text-xs font-semibold text-sunset-600"
          >
            + Add it to my list
          </button>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-3">
        {values.map((v) => (
          <span key={v} className="px-4 py-2.5 rounded-full text-sm font-medium bg-sunset-500 text-white flex items-center gap-1.5">
            {v}
            <button onClick={() => remove(v)}><X size={13} className="opacity-80" /></button>
          </span>
        ))}
      </div>

      {!noSpecific && values.length < 3 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {suggestions.filter((s) => !values.includes(s)).map((s) => (
            <button
              key={s}
              onClick={() => add(s)}
              className="px-3.5 py-2 rounded-full text-xs font-medium border border-dashed border-neutral-300 text-neutral-600 hover:border-neutral-400 flex items-center gap-1"
            >
              <Plus size={12} />{s}
            </button>
          ))}
        </div>
      )}

      {!noSpecific && values.length < 3 && (
        <div className="flex gap-2 mb-4">
          <TextInput value={input} onChange={setInput} placeholder="Or type your own" onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button onClick={() => add()} className="px-4 py-2 bg-sunset-500 text-white rounded-2xl text-sm font-semibold flex items-center gap-1"><Plus size={14} />Add</button>
        </div>
      )}

      <button
        onClick={() => onNoSpecificChange(!noSpecific)}
        className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium border transition-colors flex items-center gap-2
          ${noSpecific ? 'bg-lagoon-50 border-lagoon-300 text-lagoon-700' : 'bg-neutral-50 border-neutral-200 text-neutral-500'}`}
      >
        <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${noSpecific ? 'bg-lagoon-500 border-lagoon-500' : 'border-neutral-300'}`}>
          {noSpecific && <Check size={11} className="text-white" />}
        </span>
        I don't have a specific destination in mind
      </button>
    </div>
  )
}

function BudgetPhase({ form, set }) {
  return (
    <div className="space-y-6">
      <PhaseHeader title="What's the maximum budget per person?" subtitle="This is a constraint, not a preference — every answer matters equally." />
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2">Maximum budget (₹)</div>
        <TextInput type="number" value={form.budget_ceiling} onChange={(v) => set({ budget_ceiling: v })} placeholder="e.g. 40000" />
      </div>
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2.5">Whole trip, or excluding flights?</div>
        <div className="flex gap-2">
          {BUDGET_SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set({ budget_includes_flights: opt.value })}
              className={`flex-1 py-3 rounded-xl2 text-sm font-semibold border ${form.budget_includes_flights === opt.value ? 'bg-sunset-500 border-sunset-500 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function DatesPhase({ form, set }) {
  return (
    <div className="space-y-6">
      <PhaseHeader title="When can everyone go, and for how long?" subtitle="Dates or weekends that work, and how many days you can spare." />
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2">Dates that work for you</div>
        <div className="flex gap-2">
          <TextInput type="date" value={form.date_range_start} onChange={(v) => set({ date_range_start: v })} />
          <TextInput type="date" value={form.date_range_end} onChange={(v) => set({ date_range_end: v })} />
        </div>
      </div>
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2.5">Flexibility</div>
        <div className="flex flex-col gap-2">
          {DATE_FLEXIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set({ date_flexibility: opt.value })}
              className={`px-4 py-3 rounded-xl2 text-sm font-medium border text-left ${form.date_flexibility === opt.value ? 'bg-lagoon-600 border-lagoon-600 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2">Days you can spare (min / max)</div>
        <div className="flex items-center gap-2">
          <TextInput type="number" value={form.min_days} onChange={(v) => set({ min_days: v })} placeholder="Min days" />
          <span className="text-neutral-400">–</span>
          <TextInput type="number" value={form.max_days} onChange={(v) => set({ max_days: v })} placeholder="Max days" />
        </div>
      </div>
    </div>
  )
}

function StartingPointPhase({ form, set }) {
  return (
    <div className="space-y-6">
      <PhaseHeader title="Where are you starting from?" subtitle="Your city, and how far/how you're willing to travel." />
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2">Your city</div>
        <TextInput value={form.starting_city} onChange={(v) => set({ starting_city: v })} placeholder="e.g. Bengaluru" />
        <div className="flex flex-wrap gap-2 mt-3">
          {MAJOR_CITIES.filter((c) => c !== form.starting_city).map((c) => (
            <button
              key={c}
              onClick={() => set({ starting_city: c })}
              className="px-3.5 py-2 rounded-full text-xs font-medium border border-dashed border-neutral-300 text-neutral-600 hover:border-neutral-400"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2.5">Preferred travel mode</div>
        <div className="flex flex-wrap gap-2">
          {TRAVEL_MODES.map((m) => (
            <button
              key={m}
              onClick={() => set({ travel_mode: m })}
              className={`px-4 py-2.5 rounded-full text-sm font-medium border ${form.travel_mode === m ? 'bg-lagoon-600 border-lagoon-600 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2.5">Maximum travel time</div>
        <div className="flex flex-col gap-2">
          {TRAVEL_TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set({ travel_time_max: opt.value })}
              className={`px-4 py-3 rounded-xl2 text-sm font-medium border text-left ${form.travel_time_max === opt.value ? 'bg-sunset-500 border-sunset-500 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function PaceAndStayPhase({ form, set }) {
  return (
    <div className="space-y-6">
      <PhaseHeader title="What pace and stay do you want?" />
      <SingleChoiceRow label="Pace" options={PACE_OPTIONS} value={form.pace} onChange={(v) => set({ pace: v })} />
      <SingleChoiceRow label="Stay" options={STAY_OPTIONS} value={form.stay_type} onChange={(v) => set({ stay_type: v })} />
      <SingleChoiceRow label="Rooms" options={ROOM_OPTIONS} value={form.room_sharing} onChange={(v) => set({ room_sharing: v })} />
    </div>
  )
}

function SingleChoiceRow({ label, options, value, onChange }) {
  return (
    <div>
      <div className="text-sm font-bold text-neutral-800 mb-2.5">{label}</div>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-3 rounded-xl2 text-sm font-semibold border ${value === opt.value ? 'bg-sunset-500 border-sunset-500 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DealbreakersPhase({ form, set }) {
  const noBreakers = form.no_dealbreakers
  const [customValue, setCustomValue] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)

  function toggle(db) {
    if (noBreakers) return
    if (form.dealbreakers.includes(db)) set({ dealbreakers: form.dealbreakers.filter((d) => d !== db) })
    else set({ dealbreakers: [...form.dealbreakers, db] })
  }
  function addCustom() {
    const v = customValue.trim()
    if (!v || noBreakers) return
    if (!form.dealbreakers.includes(v)) set({ dealbreakers: [...form.dealbreakers, v] })
    setCustomValue('')
    setShowCustomInput(false)
  }
  const customSelections = form.dealbreakers.filter((d) => !DEALBREAKERS.includes(d))

  return (
    <div>
      <PhaseHeader title="What will you not do?" subtitle="Separate from preferences — these are hard limits. Pick as many as apply." />
      <div className="flex flex-wrap gap-2 mb-4">
        {DEALBREAKERS.map((db) => {
          const isSelected = form.dealbreakers.includes(db)
          return (
            <button
              key={db}
              disabled={noBreakers}
              onClick={() => toggle(db)}
              className={`px-4 py-2.5 rounded-full text-sm font-medium border flex items-center gap-1.5
                ${isSelected ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-neutral-200 text-neutral-700'}
                ${noBreakers ? 'opacity-35' : ''}`}
            >
              {isSelected && <Check size={14} />}
              {db}
            </button>
          )
        })}
        {customSelections.map((db) => (
          <button key={db} onClick={() => toggle(db)} className="px-4 py-2.5 rounded-full text-sm font-medium bg-rose-500 border border-rose-500 text-white flex items-center gap-1.5">
            <Check size={14} />{db}<X size={13} className="opacity-80" />
          </button>
        ))}
        {!noBreakers && !showCustomInput && (
          <button onClick={() => setShowCustomInput(true)} className="px-4 py-2.5 rounded-full text-sm font-medium border border-dashed border-neutral-300 text-neutral-500 flex items-center gap-1.5">
            <Plus size={14} /> Add your own
          </button>
        )}
      </div>

      {showCustomInput && (
        <div className="flex gap-2 mb-4">
          <TextInput value={customValue} onChange={setCustomValue} placeholder="e.g. Vegetarian only" onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
          <button onClick={addCustom} className="px-4 py-2 bg-sunset-500 text-white rounded-2xl text-sm font-semibold">Add</button>
        </div>
      )}

      <button
        onClick={() => set({ no_dealbreakers: !noBreakers, dealbreakers: !noBreakers ? [] : form.dealbreakers })}
        className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium border transition-colors flex items-center gap-2
          ${noBreakers ? 'bg-lagoon-50 border-lagoon-300 text-lagoon-700' : 'bg-neutral-50 border-neutral-200 text-neutral-500'}`}
      >
        <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${noBreakers ? 'bg-lagoon-500 border-lagoon-500' : 'border-neutral-300'}`}>
          {noBreakers && <Check size={11} className="text-white" />}
        </span>
        I don't have any dealbreakers
      </button>
    </div>
  )
}

function ReviewPhase({ form, onEdit }) {
  const scopeLabel = TRIP_SCOPE_OPTIONS.find((o) => o.value === form.trip_scope)?.label
  const budgetScopeLabel = BUDGET_SCOPE_OPTIONS.find((o) => o.value === form.budget_includes_flights)?.label
  const paceLabel = PACE_OPTIONS.find((o) => o.value === form.pace)?.label
  const stayLabel = STAY_OPTIONS.find((o) => o.value === form.stay_type)?.label
  const roomLabel = ROOM_OPTIONS.find((o) => o.value === form.room_sharing)?.label

  return (
    <div>
      <PhaseHeader title="Here's what matters to you" subtitle="Double check everything before you submit." />
      <div className="space-y-3">
        <ReviewCard title="National or international" onEdit={() => onEdit(STEPS.indexOf('tripScope'))}>
          {scopeLabel || 'Not set'}
        </ReviewCard>

        <ReviewCard title="Places in mind" onEdit={() => onEdit(STEPS.indexOf('destinationPick'))}>
          {form.no_specific_destination ? 'No specific destination' : (form.specific_destinations.join(', ') || 'Nothing added')}
        </ReviewCard>

        <ReviewCard title="Budget" onEdit={() => onEdit(STEPS.indexOf('budget'))}>
          {form.budget_ceiling ? `Max ₹${form.budget_ceiling} (${budgetScopeLabel})` : 'Not set'}
        </ReviewCard>

        <ReviewCard title="Dates & duration" onEdit={() => onEdit(STEPS.indexOf('datesAndDuration'))}>
          {form.date_range_start && form.date_range_end ? `${form.date_range_start} to ${form.date_range_end}` : 'Flexible'}
          {form.min_days || form.max_days ? ` · ${form.min_days || '?'}–${form.max_days || '?'} days` : ''}
        </ReviewCard>

        <ReviewCard title="Starting point" onEdit={() => onEdit(STEPS.indexOf('startingPoint'))}>
          {form.starting_city || 'City not set'} · {form.travel_mode} · {TRAVEL_TIME_OPTIONS.find((o) => o.value === form.travel_time_max)?.label}
        </ReviewCard>

        <ReviewCard title="Kind of trip" onEdit={() => onEdit(STEPS.indexOf('tripType'))}>
          {form.destination_no_pref ? 'No preference' : (form.destination_types.join(', ') || 'Nothing selected')}
        </ReviewCard>

        <ReviewCard title="Pace & stay" onEdit={() => onEdit(STEPS.indexOf('paceAndStay'))}>
          {[paceLabel, stayLabel, roomLabel].filter(Boolean).join(' · ') || 'Not set'}
        </ReviewCard>

        <ReviewCard title="Dealbreakers" onEdit={() => onEdit(STEPS.indexOf('dealbreakers'))}>
          {form.no_dealbreakers || form.dealbreakers.length === 0 ? 'None' : form.dealbreakers.join(', ')}
        </ReviewCard>
      </div>
    </div>
  )
}

function ReviewCard({ title, onEdit, children }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">{title}</span>
        <button onClick={onEdit} className="text-xs font-semibold text-sunset-500">Edit</button>
      </div>
      <p className="text-sm text-neutral-800">{children}</p>
    </Card>
  )
}
