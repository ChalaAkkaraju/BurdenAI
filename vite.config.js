import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createAiHandler } from './server/ai/handler.js'

// Serves /api/ai from the same server as the app — in `npm run dev` (localhost)
// and in `npm start` (vite preview on Railway). Settings come from environment
// variables: locally from .env.local, on Railway from the service's Variables.
function aiApi(env) {
  const handler = createAiHandler(env)
  const mount = (server) => { server.middlewares.use(handler) }
  return { name: 'burdenai-ai-api', configureServer: mount, configurePreviewServer: mount }
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    plugins: [react(), aiApi(env)],
    server: {
      port: 3410,
      strictPort: true,
      open: true
    },
    preview: {
      host: true,
      port: 4173,
      allowedHosts: true
    }
  }
})
