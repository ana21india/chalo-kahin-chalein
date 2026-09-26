import { verifyDistances } from './_lib/geo.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const { destinations, originCities } = req.body || {}
    const result = await verifyDistances(destinations || [], originCities || [])
    res.status(200).json(result)
  } catch (e) {
    console.error('verify-distances failed:', e)
    res.status(500).json({ error: e.message })
  }
}
