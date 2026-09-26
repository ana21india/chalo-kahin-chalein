// Curated, mode-aware round-trip transport COST estimates (INR per person),
// mirroring travelTimes.js exactly: same 4 broad origin regions, same
// per-destination mode availability, same rule — return null for any
// city/destination/mode we don't have a curated ballpark for, rather than
// guessing, so budget feasibility never hard-blocks someone on a
// hallucinated number. Ranges, not exact prices, per the "ballpark over
// false precision" requirement (see src/lib/destinations.js costBreakdown
// for the rest of the per-person cost — accommodation/food/local/
// activities/mandatory — which combine with this in tripLogic.js).

import { regionForCity } from './travelTimes'

export const TRANSPORT_COSTS = {
  Goa: {
    north: { Flight: [7000, 9000], Train: [1200, 2000], Road: [2500, 4000] },
    west: { Flight: [4000, 6000], Train: [800, 1500], Road: [1800, 3000] },
    south: { Flight: [4500, 6500], Train: [900, 1600], Road: [2000, 3200] },
    east: { Flight: [8000, 10000], Train: [1500, 2500], Road: [3500, 5500] },
  },
  'Bali, Indonesia': {
    north: { Flight: [35000, 45000] }, west: { Flight: [32000, 42000] },
    south: { Flight: [28000, 38000] }, east: { Flight: [26000, 36000] },
  },
  'Thailand (Phuket/Bangkok)': {
    north: { Flight: [22000, 30000] }, west: { Flight: [24000, 32000] },
    south: { Flight: [16000, 22000] }, east: { Flight: [14000, 20000] },
  },
  Vietnam: {
    north: { Flight: [24000, 32000] }, west: { Flight: [26000, 34000] },
    south: { Flight: [20000, 26000] }, east: { Flight: [14000, 20000] },
  },
  'Sri Lanka': {
    north: { Flight: [18000, 24000] }, west: { Flight: [14000, 18000] },
    south: { Flight: [9000, 13000] }, east: { Flight: [14000, 18000] },
  },
  Manali: {
    north: { Flight: [6000, 8000], Road: [1500, 2500] },
    west: { Flight: [10000, 13000], Road: [3000, 4500] },
    south: { Flight: [13000, 16000], Road: [4000, 6000] },
    east: { Flight: [14000, 17000], Road: [4500, 6500] },
  },
  Shimla: {
    north: { Train: [800, 1500], Road: [1200, 2000] },
    west: { Train: [2500, 4000], Road: [3000, 4500] },
    south: { Train: [3500, 5000], Road: [4500, 6500] },
    east: { Train: [3200, 4800], Road: [4000, 6000] },
  },
  Rishikesh: {
    north: { Train: [700, 1300], Road: [1000, 1800] },
    west: { Train: [2200, 3500], Road: [2800, 4200] },
    south: { Train: [3200, 4800], Road: [4200, 6000] },
    east: { Train: [2500, 3800], Road: [3200, 4800] },
  },
  Coorg: {
    south: { Road: [1200, 2000] }, west: { Road: [2500, 3800] },
    north: { Road: [4500, 6500] }, east: { Road: [4500, 6500] },
  },
  'Munnar & Kerala backwaters': {
    south: { Flight: [3500, 5000], Road: [1500, 2500] },
    west: { Flight: [6000, 8000], Road: [4000, 6000] },
    north: { Flight: [8000, 10500], Road: [7000, 9500] },
    east: { Flight: [8000, 10500], Road: [7000, 9500] },
  },
  'Andaman Islands': {
    south: { Flight: [12000, 16000] }, east: { Flight: [12000, 16000] },
    west: { Flight: [16000, 20000] }, north: { Flight: [18000, 22000] },
  },
  Udaipur: {
    north: { Flight: [5000, 7000], Train: [1000, 1800], Road: [1500, 2500] },
    west: { Flight: [5000, 7000], Train: [1200, 2000], Road: [1800, 2800] },
    south: { Flight: [8000, 10500], Train: [2800, 4000], Road: [3500, 5000] },
    east: { Flight: [10000, 13000], Train: [3200, 4500], Road: [4500, 6500] },
  },
  Jaipur: {
    north: { Flight: [4000, 6000], Train: [700, 1300], Road: [1000, 1800] },
    west: { Flight: [5500, 7500], Train: [1800, 2800], Road: [2200, 3500] },
    south: { Flight: [8000, 10500], Train: [3000, 4300], Road: [3500, 5000] },
    east: { Flight: [9000, 12000], Train: [3000, 4300], Road: [4000, 5800] },
  },
  'Meghalaya (Northeast India)': {
    east: { Flight: [5000, 7000], Road: [2000, 3000] },
    north: { Flight: [9000, 12000] }, west: { Flight: [11000, 14000] }, south: { Flight: [12000, 15000] },
  },
  'Dubai, UAE': {
    north: { Flight: [16000, 20000] }, west: { Flight: [15000, 19000] },
    south: { Flight: [17000, 21000] }, east: { Flight: [22000, 28000] },
  },
  Singapore: {
    north: { Flight: [20000, 26000] }, west: { Flight: [18000, 24000] },
    south: { Flight: [15000, 20000] }, east: { Flight: [13000, 18000] },
  },
  Ladakh: {
    north: { Flight: [9000, 12000], Road: [4000, 6000] },
    west: { Flight: [14000, 17000], Road: [9000, 12000] },
    south: { Flight: [16000, 19000], Road: [12000, 15000] },
    east: { Flight: [17000, 20000], Road: [11000, 14000] },
  },
  Pondicherry: {
    south: { Train: [600, 1200], Road: [900, 1500] },
    west: { Train: [2500, 3800], Road: [3000, 4500] },
    north: { Train: [3800, 5500], Road: [4500, 6500] },
    east: { Train: [2800, 4200], Road: [3200, 4800] },
  },
  Hampi: {
    south: { Train: [900, 1600], Road: [1200, 2000] },
    west: { Train: [1500, 2500], Road: [1800, 2800] },
    north: { Train: [3000, 4300], Road: [3200, 4800] },
    east: { Train: [3200, 4800], Road: [3500, 5200] },
  },
  'Kasol & Parvati Valley': {
    north: { Road: [1500, 2500] }, west: { Road: [3800, 5500] },
    south: { Road: [6000, 8500] }, east: { Road: [5500, 7800] },
  },
}

// Returns { low, high }, or null if we have no curated estimate for this
// city/destination/mode — callers must treat null as "unknown" and fall
// back to the destination's flat range, never as ₹0 or an automatic pass.
export function estimateTransportCost(destinationName, originCity, mode) {
  const region = regionForCity(originCity)
  if (!region) return null
  const range = TRANSPORT_COSTS[destinationName]?.[region]?.[mode]
  if (!Array.isArray(range)) return null
  return { low: range[0], high: range[1] }
}
