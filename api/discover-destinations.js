import { discoverDestinations } from './_lib/gemini.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const { topAxes, budgetMin, groupSize, durationMin, durationMax, excludeNames } = req.body || {}
    const results = await discoverDestinations(
      { topAxes: topAxes || [], budgetMin, groupSize, durationMin, durationMax, excludeNames: excludeNames || [] },
      process.env.GEMINI_API_KEY
    )
    res.status(200).json(results)
  } catch (e) {
    console.error('discover-destinations failed:', e)
    res.status(500).json({ error: e.message })
  }
}
