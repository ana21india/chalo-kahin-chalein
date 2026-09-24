export const DESTINATION_TYPES = [
  'Beach', 'Mountains', 'City', 'Nature', 'Adventure', 'Cultural', 'Relaxation', 'Nightlife',
]

export const ACTIVITIES = [
  'Food', 'Nightlife', 'Trekking', 'Water sports', 'Sightseeing', 'Shopping',
  'Cafés', 'Adventure', 'Wellness', 'Road trips', 'Culture', 'Relaxing',
]

export const VIBES = [
  'Relaxed', 'Adventure-heavy', 'Packed', 'Slow', 'Spontaneous', 'Planned',
  'Party-focused', 'Food-focused', 'Luxury', 'Budget-friendly',
]

export const DEALBREAKERS = [
  'Exceeds my budget',
  "Doesn't work with my dates",
  'Too much travel',
  'Too much nightlife',
  'Too little nightlife',
  'Too much trekking',
  'Too hectic',
  'Too relaxed',
  'Shared accommodation',
  'International travel',
  'Domestic travel',
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

// This prototype has no accounts, so "only the coordinator can create a
// trip" is enforced by fixing who that coordinator is rather than by login.
export const COORDINATOR_NAME = 'Riya'

export const PHASES = [
  { key: 'destinationType', title: 'Destination type', question: 'What kind of place do you want?', options: DESTINATION_TYPES },
  { key: 'activities', title: 'Activities', question: 'What do you want to do?', options: ACTIVITIES },
  { key: 'vibe', title: 'Trip vibe', question: 'What kind of trip are you looking for?', options: VIBES },
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
