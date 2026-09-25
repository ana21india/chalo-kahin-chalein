import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, ArrowRight } from 'lucide-react'
import { Screen, Card } from '../components/ui'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <Screen>
      <div className="flex-1 flex flex-col justify-center px-6 py-10">
        <div className="mb-10 text-center">
          <div className="relative inline-block mb-5">
            <svg viewBox="0 0 160 60" className="absolute -top-3 left-1/2 -translate-x-1/2 w-40 h-16 text-sunset-300/70" fill="none">
              <path d="M8 44C28 10 60 4 80 24C100 44 128 40 152 12" strokeWidth="2.5" strokeDasharray="1 9" strokeLinecap="round" stroke="currentColor" />
            </svg>
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sunset-400 to-sunset-600 shadow-glow">
              <MapPin className="text-white" size={30} />
            </div>
          </div>
          <h1 className="font-display text-3xl font-semibold text-neutral-900 leading-tight tracking-tight">Chalo Kahin Chalein</h1>
          <p className="text-neutral-500 mt-2 text-sm">Plan the trip. Not the 1,200 messages.</p>
        </div>

        <Card className="p-5">
          <button onClick={() => navigate('/create')} className="w-full flex items-center justify-between text-left">
            <div>
              <div className="font-bold text-neutral-900">Create a trip</div>
              <div className="text-xs text-neutral-500 mt-0.5">For the coordinator — start a new Trip Project and invite your group</div>
            </div>
            <ArrowRight className="text-sunset-500" size={20} />
          </button>
        </Card>
      </div>
      <p className="text-center text-[11px] text-neutral-400 pb-6 px-8">
        Got an invite link from your coordinator? Open it directly to join.
      </p>
    </Screen>
  )
}
