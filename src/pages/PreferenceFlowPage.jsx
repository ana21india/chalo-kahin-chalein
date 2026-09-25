import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, X, Plus } from 'lucide-react'
import { Screen, TopBar, Button, Card, TextInput, ProgressDots } from '../components/ui'
import ChipSelect from '../components/ChipSelect'
import {
  TRIP_SCOPE_OPTIONS, TRIP_TYPE_OPTIONS, DEALBREAKERS, BUDGET_SCOPE_OPTIONS,
  PACE_OPTIONS, STAY_OPTIONS, ROOM_OPTIONS, TRAVEL_MODES, TRAVEL_TIME_OPTIONS,
  DATE_FLEXIBILITY_OPTIONS, MAJOR_CITIES, getStoredParticipant,
  BUDGET_FLEXIBILITY_OPTIONS, DAYS_FLEXIBILITY_OPTIONS, SCOPE_FIRMNESS_OPTIONS, TRAVEL_TIME_FIRMNESS_OPTIONS,
} from '../lib/constants'
import { getTrip, getResponse, getParticipant, upsertResponse } from '../lib/api'

const STEPS = ['tripScope', 'destinationPick', 'budget', 'datesAndDuration', 'startingPoint', 'paceAndStay', 'dealbreakers', 'review']
const today = new Date().toISOString().slice(0, 10)

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
  trip_scope: 'either', scope_firmness: 'preferred',
  destination_types: [], destination_no_pref: false,
  budget_ceiling: '', budget_includes_flights: 'whole_trip', budget_flexibility: 'strict',
  date_range_start: '', date_range_end: '', date_flexibility: 'flexible', min_days: '', max_days: '', days_flexibility: 'target',
  starting_city: '', travel_mode: 'Anything', travel_time_max: 'no_limit', travel_time_firmness: 'preference',
  pace: '', stay_type: '', room_sharing: '',
  dealbreakers: [], no_dealbreakers: false,
}

export default function PreferenceFlowPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const participant = getStoredParticipant(tripId)
  const asParticipantId = searchParams.get('as')
  const editingOther = Boolean(asParticipantId && participant?.isCoordinator && asParticipantId !== participant?.id)
  const targetId = editingOther ? asParticipantId : participant?.id

  const [trip, setTrip] = useState(null)
  const [targetName, setTargetName] = useState('')
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!participant?.id) {
      navigate(`/trip/${tripId}/join`, { replace: true })
      return
    }
    if (asParticipantId && !participant.isCoordinator) {
      navigate(`/trip/${tripId}/status`, { replace: true })
      return
    }
    Promise.all([
      getTrip(tripId),
      getResponse(targetId),
      editingOther ? getParticipant(targetId) : Promise.resolve(null),
    ]).then(([t, r, targetParticipant]) => {
      setTrip(t)
      if (targetParticipant) setTargetName(targetParticipant.name)
      if (r) {
        if (r.status === 'completed' && !editingOther && !participant.isCoordinator) {
          navigate(`/trip/${tripId}/status`, { replace: true })
          return
        }
        const loaded = { ...emptyForm, ...r }
        for (const key of INTEGER_FIELDS) if (loaded[key] === null || loaded[key] === undefined) loaded[key] = ''
        for (const key of DATE_FIELDS) if (loaded[key] === null || loaded[key] === undefined) loaded[key] = ''
        if (!loaded.pace) loaded.pace = ''
        if (!loaded.stay_type) loaded.stay_type = ''
        if (!loaded.room_sharing) loaded.room_sharing = ''
        if (!loaded.starting_city) loaded.starting_city = ''
        if (!loaded.scope_firmness) loaded.scope_firmness = 'preferred'
        if (!loaded.budget_flexibility) loaded.budget_flexibility = 'strict'
        if (!loaded.days_flexibility) loaded.days_flexibility = 'target'
        if (!loaded.travel_time_firmness) loaded.travel_time_firmness = 'preference'
        setForm(loaded)
      }
      setLoading(false)
    })
  }, [tripId, targetId])

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }))
  }

  async function persist(status) {
    setSaving(true)
    try {
      await upsertResponse(tripId, targetId, { ...sanitizeForm(form), status: status || 'in_progress' })
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
    navigate(editingOther ? `/trip/${tripId}/dashboard` : `/trip/${tripId}/status`)
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
      {editingOther && (
        <div className="mx-5 mb-1 px-3 py-2 rounded-xl bg-lagoon-50 border border-lagoon-200 text-xs font-semibold text-lagoon-700">
          Editing on behalf of {targetName || 'this participant'}
        </div>
      )}
      <ProgressDots step={step} total={STEPS.length} />
      <div className="flex-1 px-5 pt-5 pb-28 overflow-y-auto">
        {current === 'tripScope' && (
          <TripScopePhase
            value={form.trip_scope}
            onChange={(v) => set({ trip_scope: v })}
            firmness={form.scope_firmness}
            onFirmnessChange={(v) => set({ scope_firmness: v })}
          />
        )}
        {current === 'destinationPick' && (
          <div>
            <PhaseHeader title="What kind of place do you want?" subtitle="Pick up to 3." />
            <ChipSelect
              options={TRIP_TYPE_OPTIONS}
              selected={form.destination_types}
              onChange={(v) => set({ destination_types: v })}
              noPreference={form.destination_no_pref}
              onNoPreferenceChange={(v) => set({ destination_no_pref: v, destination_types: v ? [] : form.destination_types })}
              max={3}
              allowCustom={false}
            />
          </div>
        )}
        {current === 'budget' && <BudgetPhase form={form} set={set} />}
        {current === 'datesAndDuration' && <DatesPhase form={form} set={set} />}
        {current === 'startingPoint' && <StartingPointPhase form={form} set={set} />}
        {current === 'paceAndStay' && <PaceAndStayPhase form={form} set={set} />}
        {current === 'dealbreakers' && <DealbreakersPhase form={form} set={set} />}
        {current === 'review' && <ReviewPhase form={form} onEdit={(i) => setStep(i)} />}
      </div>

      <div className="px-5 py-4 border-t border-neutral-100 bg-cream relative z-10 flex gap-2">
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
      <h2 className="font-display text-2xl font-semibold text-neutral-900 leading-snug tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-neutral-500 mt-1.5">{subtitle}</p>}
    </div>
  )
}

function AutocompleteInput({ value, onChange, options, placeholder, onCommit }) {
  const [open, setOpen] = useState(false)
  const hasInput = (value || '').trim().length > 0
  const filtered = hasInput
    ? options
        .filter((o) => o.toLowerCase() !== value.toLowerCase())
        .filter((o) => o.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 6)
    : []

  return (
    <div className="relative">
      <TextInput
        value={value}
        onChange={(v) => { onChange(v); setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => e.key === 'Enter' && onCommit && onCommit()}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-10 mt-1.5 w-full bg-white border border-neutral-200 rounded-2xl shadow-soft overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map((o) => (
            <button
              key={o}
              onMouseDown={() => { onChange(o); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TripScopePhase({ value, onChange, firmness, onFirmnessChange }) {
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

      {(value === 'national' || value === 'international') && (
        <div className="mt-6">
          <div className="text-sm font-bold text-neutral-800 mb-2.5">How firm is this?</div>
          <div className="flex flex-col gap-2">
            {SCOPE_FIRMNESS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onFirmnessChange(opt.value)}
                className={`px-4 py-3 rounded-xl2 text-sm font-medium border text-left ${firmness === opt.value ? 'bg-lagoon-600 border-lagoon-600 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2.5">How firm is this number?</div>
        <div className="flex flex-col gap-2">
          {BUDGET_FLEXIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set({ budget_flexibility: opt.value })}
              className={`px-4 py-3 rounded-xl2 text-sm font-medium border text-left ${form.budget_flexibility === opt.value ? 'bg-lagoon-600 border-lagoon-600 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
            >
              <div>{opt.label}</div>
              <div className={`text-xs mt-0.5 ${form.budget_flexibility === opt.value ? 'text-white/80' : 'text-neutral-400'}`}>{opt.hint}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function DatesPhase({ form, set }) {
  const minEnd = form.date_range_start > today ? form.date_range_start : today

  function setStart(v) {
    const clamped = v && v < today ? today : v
    const patch = { date_range_start: clamped }
    if (clamped && form.date_range_end && form.date_range_end < clamped) patch.date_range_end = clamped
    set(patch)
  }
  function setEnd(v) {
    set({ date_range_end: v && v < minEnd ? minEnd : v })
  }

  return (
    <div className="space-y-6">
      <PhaseHeader title="When can everyone go, and for how long?" subtitle="Dates or weekends that work, and how many days you can spare." />
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2">Dates that work for you</div>
        <div className="flex gap-2">
          <TextInput type="date" value={form.date_range_start} onChange={setStart} min={today} />
          <TextInput type="date" value={form.date_range_end} onChange={setEnd} min={minEnd} />
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
      <div>
        <div className="text-sm font-bold text-neutral-800 mb-2.5">Is that your actual available time, or roughly what you're aiming for?</div>
        <div className="flex flex-col gap-2">
          {DAYS_FLEXIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set({ days_flexibility: opt.value })}
              className={`px-4 py-3 rounded-xl2 text-sm font-medium border text-left ${form.days_flexibility === opt.value ? 'bg-lagoon-600 border-lagoon-600 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
            >
              <div>{opt.label}</div>
              <div className={`text-xs mt-0.5 ${form.days_flexibility === opt.value ? 'text-white/80' : 'text-neutral-400'}`}>{opt.hint}</div>
            </button>
          ))}
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
        <AutocompleteInput
          value={form.starting_city}
          onChange={(v) => set({ starting_city: v })}
          options={MAJOR_CITIES}
          placeholder="e.g. Bengaluru"
        />
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

      {form.travel_time_max !== 'no_limit' && (
        <div>
          <div className="text-sm font-bold text-neutral-800 mb-2.5">Is that a hard limit or a preference?</div>
          <div className="flex gap-2">
            {TRAVEL_TIME_FIRMNESS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set({ travel_time_firmness: opt.value })}
                className={`flex-1 py-3 rounded-xl2 text-sm font-semibold border ${form.travel_time_firmness === opt.value ? 'bg-sunset-500 border-sunset-500 text-white' : 'bg-white border-neutral-200 text-neutral-700'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
  const firmnessLabel = SCOPE_FIRMNESS_OPTIONS.find((o) => o.value === form.scope_firmness)?.label
  const budgetScopeLabel = BUDGET_SCOPE_OPTIONS.find((o) => o.value === form.budget_includes_flights)?.label
  const budgetFlexLabel = BUDGET_FLEXIBILITY_OPTIONS.find((o) => o.value === form.budget_flexibility)?.label
  const daysFlexLabel = DAYS_FLEXIBILITY_OPTIONS.find((o) => o.value === form.days_flexibility)?.label
  const travelTimeFirmnessLabel = TRAVEL_TIME_FIRMNESS_OPTIONS.find((o) => o.value === form.travel_time_firmness)?.label
  const paceLabel = PACE_OPTIONS.find((o) => o.value === form.pace)?.label
  const stayLabel = STAY_OPTIONS.find((o) => o.value === form.stay_type)?.label
  const roomLabel = ROOM_OPTIONS.find((o) => o.value === form.room_sharing)?.label

  return (
    <div>
      <PhaseHeader title="Here's what matters to you" subtitle="Double check everything before you submit." />
      <div className="space-y-3">
        <ReviewCard title="National or international" onEdit={() => onEdit(STEPS.indexOf('tripScope'))}>
          {scopeLabel || 'Not set'}{(form.trip_scope === 'national' || form.trip_scope === 'international') ? ` · ${firmnessLabel}` : ''}
        </ReviewCard>

        <ReviewCard title="Kind of trip" onEdit={() => onEdit(STEPS.indexOf('destinationPick'))}>
          {form.destination_no_pref ? 'No preference' : (form.destination_types.join(', ') || 'Nothing selected')}
        </ReviewCard>

        <ReviewCard title="Budget" onEdit={() => onEdit(STEPS.indexOf('budget'))}>
          {form.budget_ceiling ? `Max ₹${form.budget_ceiling} (${budgetScopeLabel}) · ${budgetFlexLabel}` : 'Not set'}
        </ReviewCard>

        <ReviewCard title="Dates & duration" onEdit={() => onEdit(STEPS.indexOf('datesAndDuration'))}>
          {form.date_range_start && form.date_range_end ? `${form.date_range_start} to ${form.date_range_end}` : 'Flexible'}
          {form.min_days || form.max_days ? ` · ${form.min_days || '?'}–${form.max_days || '?'} days (${daysFlexLabel})` : ''}
        </ReviewCard>

        <ReviewCard title="Starting point" onEdit={() => onEdit(STEPS.indexOf('startingPoint'))}>
          {form.starting_city || 'City not set'} · {form.travel_mode} · {TRAVEL_TIME_OPTIONS.find((o) => o.value === form.travel_time_max)?.label}
          {form.travel_time_max !== 'no_limit' ? ` (${travelTimeFirmnessLabel})` : ''}
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
