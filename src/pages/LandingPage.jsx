import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Users, ArrowRight } from 'lucide-react'
import { Screen, Button, Card, TextInput } from '../components/ui'

export default function LandingPage() {
  const navigate = useNavigate()
  const [joinLink, setJoinLink] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [error, setError] = useState('')

  function handleJoin() {
    setError('')
    const raw = joinLink.trim()
    if (!raw) return
    const match = raw.match(/trip\/([a-zA-Z0-9-]+)/)
    const tripId = match ? match[1] : raw
    if (!tripId || tripId.length < 10) {
      setError("That doesn't look like a valid invite link. Paste the full link your coordinator sent.")
      return
    }
    navigate(`/trip/${tripId}`)
  }

  return (
    <Screen>
      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sunset-400 to-sunset-600 shadow-soft mb-5">
            <MapPin className="text-white" size={30} />
          </div>
          <h1 className="text-3xl font-extrabold text-neutral-900 leading-tight">Chalo Kahin Chalein</h1>
          <p className="text-neutral-500 mt-2 text-sm">Plan the trip. Not the 1,200 messages.</p>
        </div>

        {!showJoin ? (
          <div className="space-y-3">
            <Card className="p-5">
              <button onClick={() => navigate('/create')} className="w-full flex items-center justify-between text-left">
                <div>
                  <div className="font-bold text-neutral-900">Create a trip</div>
                  <div className="text-xs text-neutral-500 mt-0.5">Start a new Trip Project and invite your group</div>
                </div>
                <ArrowRight className="text-sunset-500" size={20} />
              </button>
            </Card>
            <Card className="p-5">
              <button onClick={() => setShowJoin(true)} className="w-full flex items-center justify-between text-left">
                <div>
                  <div className="font-bold text-neutral-900">Join a trip</div>
                  <div className="text-xs text-neutral-500 mt-0.5">Got an invite link? Paste it here</div>
                </div>
                <Users className="text-lagoon-600" size={20} />
              </button>
            </Card>
          </div>
        ) : (
          <div className="space-y-3">
            <Card className="p-5 space-y-3">
              <div className="font-bold text-neutral-900">Join a trip</div>
              <TextInput value={joinLink} onChange={setJoinLink} placeholder="Paste your invite link" />
              {error && <p className="text-xs text-rose-500">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowJoin(false)} className="flex-1">Back</Button>
                <Button onClick={handleJoin} className="flex-1">Continue</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
      <p className="text-center text-[11px] text-neutral-400 pb-6 px-8">
        No sign-up needed. Just a name and your preferences.
      </p>
    </Screen>
  )
}
