import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { explainOptions, discoverDestinations } from './api/_lib/gemini.js'

// Lets `npm run dev` serve the /api routes too, so local dev and the
// deployed Vercel functions share the exact same implementation
// (api/_lib/gemini.js) instead of drifting apart.
function jsonMiddleware(path, handler) {
  return (req, res, next) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', async () => {
      try {
        const result = await handler(JSON.parse(body || '{}'))
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result))
      } catch (e) {
        console.error(`${path} (dev) failed:`, e)
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: e.message }))
      }
    })
  }
}

function apiDevMiddleware() {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/explain-options', jsonMiddleware('/api/explain-options', ({ options, groupSize }) =>
        explainOptions({ options, groupSize }, process.env.GEMINI_API_KEY)
      ))
      server.middlewares.use('/api/discover-destinations', jsonMiddleware('/api/discover-destinations', ({ topAxes, budgetMin, groupSize, durationMin, durationMax, excludeNames }) =>
        discoverDestinations({ topAxes: topAxes || [], budgetMin, groupSize, durationMin, durationMax, excludeNames: excludeNames || [] }, process.env.GEMINI_API_KEY)
      ))
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load ALL env vars (not just VITE_-prefixed ones) into process.env so the
  // dev middleware above can read GEMINI_API_KEY server-side, the same way
  // the Vercel function reads it from its own environment. It is never
  // exposed to client code — only import.meta.env.VITE_* vars are, and
  // GEMINI_API_KEY deliberately has no VITE_ prefix.
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [react(), apiDevMiddleware()],
    server: { port: 5183 },
  }
})
