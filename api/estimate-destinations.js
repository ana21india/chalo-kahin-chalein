import { estimateDestination } from './_lib/gemini.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const { names } = req.body || {}
    const unique = [...new Set((names || []).map((n) => n.trim()).filter(Boolean))]
    const results = await Promise.all(
      unique.map(async (name) => {
        try {
          return await estimateDestination(name, process.env.GEMINI_API_KEY)
        } catch (e) {
          console.error(`estimate-destinations failed for "${name}":`, e)
          return null
        }
      })
    )
    res.status(200).json(results.filter(Boolean))
  } catch (e) {
    console.error('estimate-destinations failed:', e)
    res.status(500).json({ error: e.message })
  }
}
