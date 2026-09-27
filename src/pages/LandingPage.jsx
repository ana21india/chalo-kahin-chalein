import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, ArrowRight } from 'lucide-react'
import { Screen, Card } from '../components/ui'

// A small original illustrated scene (hills, sun, palm trees, a road-trip
// van) in the brand's navy/gold palette — sets the playful, travel-forward
// tone for the hero without relying on any external image asset.
function HeroIllustration() {
  return (
    <svg viewBox="0 0 400 230" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      <circle cx="205" cy="95" r="46" className="fill-sunset-300/70" />
      <path d="M0 150C60 100 130 90 200 120C270 150 330 145 400 105V230H0V150Z" className="fill-lagoon-200/70" />
      <path d="M0 175C70 140 150 135 220 160C280 180 340 175 400 150V230H0V175Z" className="fill-lagoon-300/70" />
      <g className="fill-lagoon-800">
        <path d="M42 178C40 150 52 128 44 108C56 118 62 140 58 158C70 148 82 152 88 166C74 162 64 172 60 186C56 172 48 172 42 178Z" />
        <rect x="49" y="176" width="4" height="34" rx="2" />
      </g>
      <g className="fill-lagoon-900">
        <path d="M352 168C350 144 360 126 353 110C363 118 368 136 365 151C375 143 385 146 390 158C378 155 370 163 367 174C364 163 357 163 352 168Z" />
        <rect x="358" y="166" width="4" height="30" rx="2" />
      </g>
      <path d="M0 210H400V230H0Z" className="fill-lagoon-800" />
      <g transform="translate(120 152)">
        <rect x="0" y="18" width="150" height="42" rx="14" className="fill-sunset-400" />
        <path d="M8 18C8 4 20 -6 40 -6H108C124 -6 136 4 138 18Z" className="fill-sunset-500" />
        <rect x="18" y="1" width="30" height="20" rx="4" className="fill-lagoon-50" />
        <rect x="55" y="1" width="30" height="20" rx="4" className="fill-lagoon-50" />
        <rect x="92" y="1" width="30" height="20" rx="4" className="fill-lagoon-50" />
        <rect x="20" y="-16" width="20" height="12" rx="2" className="fill-lagoon-600" />
        <rect x="44" y="-16" width="10" height="12" rx="2" className="fill-sunset-200" />
        <circle cx="35" cy="62" r="13" className="fill-lagoon-900" />
        <circle cx="35" cy="62" r="5" className="fill-lagoon-50" />
        <circle cx="118" cy="62" r="13" className="fill-lagoon-900" />
        <circle cx="118" cy="62" r="5" className="fill-lagoon-50" />
      </g>
      {[[24, 60], [340, 40], [70, 30], [300, 75], [180, 25]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 2 ? 2.5 : 1.6} className="fill-white/80" />
      ))}
    </svg>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <Screen>
      <div className="flex-1 flex flex-col justify-center px-6 py-8">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-lagoon-800 shadow-glowLagoon mb-4">
            <MapPin className="text-sunset-400" size={26} />
          </div>
          <h1 className="font-display text-4xl font-bold text-lagoon-800 leading-tight">
            Lifelong memories,
            <br />
            <span className="relative inline-block">
              <span className="absolute inset-x-0 bottom-1 h-3 bg-sunset-300 -z-10 rounded-sm" />
              zero group chaos
            </span>
          </h1>
          <p className="text-neutral-500 mt-3 text-sm">Chalo Kahin Chalein — plan the trip, not the 1,200 messages.</p>
        </div>

        <HeroIllustration />

        <Card className="p-5 mt-6">
          <button onClick={() => navigate('/create')} className="w-full flex items-center justify-between text-left">
            <div>
              <div className="font-bold text-lagoon-800">Create a trip</div>
              <div className="text-xs text-neutral-500 mt-0.5">For the coordinator — start a new Trip Project and invite your group</div>
            </div>
            <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-lagoon-800">
              <ArrowRight className="text-sunset-400" size={18} />
            </span>
          </button>
        </Card>
      </div>
      <p className="text-center text-[11px] text-neutral-400 pb-6 px-8">
        Got an invite link from your coordinator? Open it directly to join.
      </p>
    </Screen>
  )
}
