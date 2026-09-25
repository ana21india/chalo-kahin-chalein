import { explainOptions } from './_lib/gemini.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const { options, groupSize } = req.body || {}
    const result = await explainOptions({ options, groupSize }, process.env.GEMINI_API_KEY)
    res.status(200).json(result)
  } catch (e) {
    console.error('explain-options failed:', e)
    res.status(500).json({ error: e.message })
  }
}
