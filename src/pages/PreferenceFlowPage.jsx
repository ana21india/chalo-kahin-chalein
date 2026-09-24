import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, X, Plus } from 'lucide-react'
import { Screen, TopBar, Button, Card, TextInput, ProgressDots } from '../components/ui'
import ChipSelect from '../components/ChipSelect'
import {
  DESTINATION_TYPES, ACTIVITIES, VIBES, DEALBREAKERS, TRAVEL_MODES, TRAVEL_TIME_OPTIONS,
  DATE_FLEXIBILITY_OPTIONS, TRIP_SCOPE_OPTIONS, getStoredParticipant,
} from '../lib/constants'
import { DESTINATIONS } from '../lib/destinations'
import { getTrip, getResponse, upsertResponse } from '../lib/api'

const STEPS = ['destinationType', 'activities', 'vibe', 'tripScope', 'specificDestinations', 'budget', 'dates', 'travel', 'dealbreakers', 'review']

const INTEGER_FIELDS = ['budget_min', 'budget_max', 'budget_ceiling', 'min_days', 'max_days']
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
  destination_types: [], destination_no_pref: false,
  activities: [], activities_no_pref: false,
  vibes: [], vibes_no_pref: false,
  trip_scope: 'either',
  specific_destinations: [], no_specific_destination: false, include_coordinator_destination: null,
  budget_min: '', budget_max: '', budget_ceiling: '', budget_hard_limit: true,
  date_range_start: '', date_range_end: '', date_flexibility: 'flexible', min_days: '', max_days: '',
  travel_mode: 'Anything', travel_time_max: 'no_limit',
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
  const [destChoice, setDestChoice] = useState(null)

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
        setForm(loaded)
        setDestChoice(r.include_coordinator_destination)
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
        {current === 'destinationType' && (
          <PhaseTop3
            title="What kind of place do you want?"
            subtitle="Pick what matters most to you. You can choose up to 3."
            options={DESTINATION_TYPES}
            selected={form.destination_types}
            noPreference={form.destination_no_pref}
            onChange={(v) => set({ destination_types: v })}
            onNoPreferenceChange={(v) => set({ destination_no_pref: v })}
          />
        )}
        {current === 'activities' && (
          <PhaseTop3
            title="What do you want to do?"
            subtitle="Up to 3 activities that matter most."
            options={ACTIVITIES}
            selected={form.activities}
            noPreference={form.activities_no_pref}
            onChange={(v) => set({ activities: v })}
            onNoPreferenceChange={(v) => set({ activities_no_pref: v })}
          />
        )}
        {current === 'vibe' && (
          <PhaseTop3
            title="What kind of trip are you looking for?"
            subtitle="Pick up to 3 words that describe your ideal trip."
            options={VIBES}
            selected={form.vibes}
            noPreference={form.vibes_no_pref}
            onChange={(v) => set({ vibes: v })}
            onNoPreferenceChange={(v) => set({ vibes_no_pref: v })}
          />
        )}
        {current === 'tripScope' && (
          <TripScopePhase value={form.trip_scope} onChange={(v) => set({ trip_scope: v })} />
        )}
        {current === 'specificDestinations' && (
          <SpecificDestinations
            trip={trip}
            scope={form.trip_scope}
            values={form.specific_destinations}
            noSpecific={form.no_specific_destination}
            includeCoordinatorDestination={form.include_coordinator_destination}
            onValuesChange={(v) => set({ specific_destinations: v })}
            onNoSpecificChange={(v) => set({ no_specific_destination: v, specific_destinations: v ? [] : form.specific_destinations })}
            onIncludeCoordinatorChange={(v) => {
              set({ include_coordinator_destination: v })
              if (v && trip.initial_destination) {
                const exists = form.specific_destinations.includes(trip.initial_destination)
                if (!exists && form.specific_destinations.length < 3) {
                  set({ specific_destinations: [...form.specific_destinations, trip.initial_destination] })
                }
              }
            }}
          />
        )}
        {current === 'budget' && <BudgetPhase form={form} set={set} />}
        {current === 'dates' && <DatesPhase form={form} set={set} />}
        {current === 'travel' && <TravelPhase form={form} set={set} />}
        {current === 'dealbreakers' && <DealbreakersPhase form={form} set={set} />}
        {current === 'review' && <ReviewPhase form={form} trip={trip} onEdit={(i) => setStep(i)} />}
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

function PhaseTop3({ title, subtitle, options, selected, noPreference, onChange, onNoPreferenceChange }) {
  return (
    <div>
      <PhaseHeader title={title} subtitle={subtitle} />
      <ChipSelect
        options={options}
        selected={selected}
        onChange={onChange}
        noPreference={noPreference}
        onNoPreferenceChange={onNoPreferenceChange}
      />
    </div>
  )
}

function TripScopePhase({ value, onChange }) {
  return (
    <div>
      <PhaseHeader title="National or international?" subtitle="This helps us suggest the right kind of places next." />
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

function SpecificDestinations({ trip, scope, values, noSpecific, includeCoordinatorDestination, onValuesChange, onNoSpecificChange, onIncludeCoordinatorChange }) {
  const [input, setInput] = useState('')

  const suggestions = useMemo(() => {
    const pool = DESTINATIONS.filter((d) => {
      if (scope === 'national') return d.domestic
      if (scope === 'international') return !d.domestic
      return true
    })
    return pool.slice(0, 8).map((d) => d.name)
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
        title="Is there somewhere you specifically want to go?"
        subtitle={
          scope === 'national' ? 'A few popular picks within India — or add your own. Up to 3.'
          : scope === 'international' ? 'A few popular picks abroad — or add your own. Up to 3.'
          : 'Add up to 3 places. Totally optional.'
        }
      />

      {trip.initial_destination && trip.initial_destination.toLowerCase() !== 'not decided yet' && (
        <Card className="p-4 mb-4 bg-sunset-50 border-sunset-100">
          <p className="text-sm text-neutral-700">
            Your coordinator suggested <span className="font-bold">{trip.initial_destination}</span>. Do you want to include it in your preferences?
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onIncludeCoordinatorChange(true)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${includeCoordinatorDestination === true ? 'bg-sunset-500 border-sunset-500 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
            >
              Yes
            </button>
            <button
              onClick={() => onIncludeCoordinatorChange(false)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${includeCoordinatorDestination === false ? 'bg-neutral-700 border-neutral-700 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
            >
              No
            </button>
          </div>
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
          <TextInput value={input} onChange={setInput} placeholder="e.g. Goa, Bali, Vietnam" onKeyDown={(e) => e.key === 'Enter' && add()} />
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
      <PhaseHeader title="What's your budget?" subtitle="This is a constraint, not a preference — every answer matters equally." />
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2">Comfortable budget per person (₹)</div>
        <div className="flex items-center gap-2">
          <TextInput type="number" value={form.budget_min} onChange={(v) => set({ budget_min: v })} placeholder="Min" />
          <span className="text-neutral-400">–</span>
          <TextInput type="number" value={form.budget_max} onChange={(v) => set({ budget_max: v })} placeholder="Max" />
        </div>
      </div>
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2">Maximum budget per person (₹)</div>
        <TextInput type="number" value={form.budget_ceiling} onChange={(v) => set({ budget_ceiling: v })} placeholder="Absolute ceiling" />
      </div>
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2.5">Is your maximum budget a hard limit?</div>
        <div className="flex gap-2">
          <button
            onClick={() => set({ budget_hard_limit: true })}
            className={`flex-1 py-3 rounded-xl2 text-sm font-semibold border ${form.budget_hard_limit ? 'bg-sunset-500 border-sunset-500 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
          >Yes</button>
          <button
            onClick={() => set({ budget_hard_limit: false })}
            className={`flex-1 py-3 rounded-xl2 text-sm font-semibold border ${!form.budget_hard_limit ? 'bg-sunset-500 border-sunset-500 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
          >No</button>
        </div>
      </div>
    </div>
  )
}

function DatesPhase({ form, set }) {
  return (
    <div className="space-y-6">
      <PhaseHeader title="When can you travel?" subtitle="Constraints, not preferences — help us find dates that actually work." />
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2">Preferred date range</div>
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
        <div className="text-sm font-bold text-neutral-800 mb-2">Available days (min / max)</div>
        <div className="flex items-center gap-2">
          <TextInput type="number" value={form.min_days} onChange={(v) => set({ min_days: v })} placeholder="Min days" />
          <span className="text-neutral-400">–</span>
          <TextInput type="number" value={form.max_days} onChange={(v) => set({ max_days: v })} placeholder="Max days" />
        </div>
      </div>
    </div>
  )
}

function TravelPhase({ form, set }) {
  return (
    <div className="space-y-6">
      <PhaseHeader title="Travel preferences" />
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
        <div className="text-sm font-bold text-neutral-800 mb-2.5">Maximum acceptable travel time</div>
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

function DealbreakersPhase({ form, set }) {
  const noBreakers = form.no_dealbreakers
  function toggle(db) {
    if (noBreakers) return
    if (form.dealbreakers.includes(db)) set({ dealbreakers: form.dealbreakers.filter((d) => d !== db) })
    else set({ dealbreakers: [...form.dealbreakers, db] })
  }
  return (
    <div>
      <PhaseHeader title="What would make you say NO to a trip?" subtitle="Separate from preferences — these are hard limits. Pick as many as apply." />
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
      </div>
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
  const rows = [
    { title: 'Destination preferences', step: STEPS.indexOf('destinationType'), items: form.destination_no_pref ? ['No preference'] : form.destination_types },
    { title: 'Activities', step: STEPS.indexOf('activities'), items: form.activities_no_pref ? ['No preference'] : form.activities },
    { title: 'Trip vibe', step: STEPS.indexOf('vibe'), items: form.vibes_no_pref ? ['No preference'] : form.vibes },
    { title: 'National or international', step: STEPS.indexOf('tripScope'), items: scopeLabel ? [scopeLabel] : [] },
    { title: 'Specific destinations', step: STEPS.indexOf('specificDestinations'), items: form.no_specific_destination ? ['No specific destination'] : form.specific_destinations },
  ]
  return (
    <div>
      <PhaseHeader title="Here's what matters to you" subtitle="Double check everything before you submit." />
      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.title} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">{row.title}</span>
              <button onClick={() => onEdit(row.step)} className="text-xs font-semibold text-sunset-500">Edit</button>
            </div>
            {row.items.length ? (
              <ol className="text-sm text-neutral-800 space-y-0.5">
                {row.items.map((it, i) => <li key={it}>{i + 1}. {it}</li>)}
              </ol>
            ) : (
              <p className="text-sm text-neutral-400">Nothing selected</p>
            )}
          </Card>
        ))}

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Budget</span>
            <button onClick={() => onEdit(STEPS.indexOf('budget'))} className="text-xs font-semibold text-sunset-500">Edit</button>
          </div>
          <p className="text-sm text-neutral-800">
            {form.budget_min || form.budget_max ? `₹${form.budget_min || '0'}–₹${form.budget_max || '?'}` : 'Not set'}
            {form.budget_ceiling ? ` · max ₹${form.budget_ceiling}${form.budget_hard_limit ? ' (hard limit)' : ''}` : ''}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Dates</span>
            <button onClick={() => onEdit(STEPS.indexOf('dates'))} className="text-xs font-semibold text-sunset-500">Edit</button>
          </div>
          <p className="text-sm text-neutral-800">
            {form.date_range_start && form.date_range_end ? `${form.date_range_start} to ${form.date_range_end}` : 'Flexible'}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">Dealbreakers</span>
            <button onClick={() => onEdit(STEPS.indexOf('dealbreakers'))} className="text-xs font-semibold text-sunset-500">Edit</button>
          </div>
          {form.no_dealbreakers || form.dealbreakers.length === 0 ? (
            <p className="text-sm text-neutral-400">None</p>
          ) : (
            <ul className="text-sm text-neutral-800 space-y-0.5">
              {form.dealbreakers.map((d) => <li key={d}>• {d}</li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
