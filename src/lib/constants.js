export const TRIP_SCOPE_OPTIONS = [
  { value: 'national', label: 'National', hint: 'Within India' },
  { value: 'international', label: 'International', hint: 'Outside India' },
  { value: 'either', label: 'Either works for me', hint: 'No strong preference' },
]

// "Culture" is what we show; it maps to the catalog's "Cultural" tag.
export const TRIP_TYPE_OPTIONS = [
  'Beach', 'Mountains', 'City', 'Culture', 'Adventure', 'Relaxation',
]

export const DEALBREAKERS = [
  'No trekking',
  'No red-eye flights',
  'No long drives',
  'Food restrictions',
  'Exceeds my budget',
  "Doesn't work with my dates",
]

export const BUDGET_SCOPE_OPTIONS = [
  { value: 'whole_trip', label: 'Whole trip' },
  { value: 'excluding_flights', label: 'Excluding flights' },
]

export const PACE_OPTIONS = [
  { value: 'packed', label: 'Packed' },
  { value: 'slow', label: 'Slow' },
]

export const STAY_OPTIONS = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'rental', label: 'Rental (Airbnb-style)' },
]

export const ROOM_OPTIONS = [
  { value: 'shared', label: 'Shared rooms' },
  { value: 'separate', label: 'Separate rooms' },
]

export const TRAVEL_MODES = ['Flight', 'Train', 'Road', 'Anything']

export const TRAVEL_TIME_OPTIONS = [
  { value: 'under_3h', label: 'Under 3 hours' },
  { value: 'under_6h', label: 'Under 6 hours' },
  { value: 'under_12h', label: 'Under 12 hours' },
  { value: 'no_limit', label: "Doesn't matter" },
]

export const DURATION_OPTIONS = [
  'Weekend', '3-4 days', '5-7 days', '7+ days', 'Not decided',
]

export const DATES_TYPE_OPTIONS = [
  { value: 'specific', label: 'Specific dates' },
  { value: 'range', label: 'Date range' },
  { value: 'month', label: 'Month' },
  { value: 'flexible', label: 'Flexible / not decided' },
]

export const DATE_FLEXIBILITY_OPTIONS = [
  { value: 'fixed', label: 'These dates only' },
  { value: 'flexible', label: 'A few days either way' },
  { value: 'very_flexible', label: 'Very flexible' },
]

export function participantStorageKey(tripId) {
  return `ckc:participant:${tripId}`
}

export function getStoredParticipant(tripId) {
  try {
    const raw = localStorage.getItem(participantStorageKey(tripId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function storeParticipant(tripId, participant) {
  try {
    localStorage.setItem(participantStorageKey(tripId), JSON.stringify(participant))
  } catch {
    // ignore storage errors
  }
}
