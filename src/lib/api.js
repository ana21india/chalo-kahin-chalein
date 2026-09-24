import { supabase } from './supabase'

export async function createTrip({ coordinatorName, tripName, initialDestination, datesType, dateStart, dateEnd, dateMonth, duration }) {
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .insert({
      name: tripName,
      coordinator_name: coordinatorName,
      initial_destination: initialDestination || '',
      dates_type: datesType,
      date_start: dateStart || null,
      date_end: dateEnd || null,
      date_month: dateMonth || null,
      duration,
    })
    .select()
    .single()
  if (tripError) throw tripError

  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .insert({ trip_id: trip.id, name: coordinatorName, is_coordinator: true })
    .select()
    .single()
  if (participantError) throw participantError

  await supabase.from('trips').update({ coordinator_id: participant.id }).eq('id', trip.id)

  return { trip, participant }
}

export async function getTrip(tripId) {
  const { data, error } = await supabase.from('trips').select('*').eq('id', tripId).single()
  if (error) throw error
  return data
}

export async function joinTrip(tripId, name) {
  const { data, error } = await supabase
    .from('participants')
    .insert({ trip_id: tripId, name, is_coordinator: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getParticipant(participantId) {
  const { data, error } = await supabase.from('participants').select('*').eq('id', participantId).single()
  if (error) throw error
  return data
}

export async function getParticipants(tripId) {
  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getResponses(tripId) {
  const { data, error } = await supabase.from('responses').select('*').eq('trip_id', tripId)
  if (error) throw error
  return data
}

export async function getResponse(participantId) {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('participant_id', participantId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertResponse(tripId, participantId, patch) {
  const { data, error } = await supabase
    .from('responses')
    .upsert(
      { trip_id: tripId, participant_id: participantId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'participant_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getVotes(tripId) {
  const { data, error } = await supabase.from('votes').select('*').eq('trip_id', tripId)
  if (error) throw error
  return data
}

export async function castVote(tripId, participantId, optionName) {
  const { data, error } = await supabase
    .from('votes')
    .upsert({ trip_id: tripId, participant_id: participantId, option_name: optionName }, { onConflict: 'participant_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setTripStatus(tripId, status, finalDestination) {
  const patch = { status }
  if (finalDestination) patch.final_destination = finalDestination
  const { error } = await supabase.from('trips').update(patch).eq('id', tripId)
  if (error) throw error
}

export function subscribeToTrip(tripId, onChange) {
  const channel = supabase
    .channel(`trip-${tripId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `trip_id=eq.${tripId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'responses', filter: `trip_id=eq.${tripId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `trip_id=eq.${tripId}` }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
