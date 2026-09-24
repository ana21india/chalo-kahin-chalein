export const TRIP_SCOPE_OPTIONS = [
  { value: 'national', label: 'National', hint: 'Within India' },
  { value: 'international', label: 'International', hint: 'Outside India' },
  { value: 'either', label: 'Either works for me', hint: 'No strong preference' },
]

export const TRIP_TYPE_OPTIONS = [
  'Beach', 'Mountains', 'City', 'Parks & nature', 'Cultural', 'Adventure', 'Nightlife', 'Romantic',
]

export const MAJOR_CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad',
  'Pune', 'Ahmedabad', 'Jaipur', 'Chandigarh', 'Kochi', 'Lucknow',
]

// "Exceeds my budget" and "Doesn't work with my dates" are deliberately not
// here — budget firmness and date flexibility each capture that directly,
// so a checkbox here would just be the same fact asked a second time with a
// second, possibly contradictory answer.
export const DEALBREAKERS = [
  'No trekking',
  'No red-eye flights',
  'No long drives',
  'Food restrictions',
]

export const BUDGET_SCOPE_OPTIONS = [
  { value: 'whole_trip', label: 'Whole trip' },
  { value: 'excluding_flights', label: 'Excluding flights' },
]

export const BUDGET_FLEXIBILITY_OPTIONS = [
  { value: 'strict', label: 'Strict', hint: 'Cannot exceed this' },
  { value: 'somewhat_flexible', label: 'Somewhat flexible', hint: 'Can stretch ~10-15%' },
  { value: 'flexible', label: 'Flexible', hint: 'Willing to spend more for the right trip' },
]

export const DAYS_FLEXIBILITY_OPTIONS = [
  { value: 'fixed', label: 'Fixed availability', hint: 'This is exactly what I have' },
  { value: 'target', label: 'Rough target', hint: 'Could extend or shorten' },
]

export const SCOPE_FIRMNESS_OPTIONS = [
  { value: 'preferred', label: 'Preferred' },
  { value: 'strong', label: 'Strong preference' },
  { value: 'non_negotiable', label: 'Non-negotiable' },
]

export const TRAVEL_TIME_FIRMNESS_OPTIONS = [
  { value: 'hard', label: 'Hard limit' },
  { value: 'preference', label: 'Preference' },
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
