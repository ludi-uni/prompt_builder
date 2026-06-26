import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePort } from './find-port.mjs'
import {
  API_PORT_END,
  API_PORT_START,
  DEFAULT_API_PORT,
  DEFAULT_WEB_PORT,
  WEB_PORT_END,
  WEB_PORT_START,
} from './ports.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const apiPort = await resolvePort(process.env.PROMPT_STUDIO_API_PORT, API_PORT_START, API_PORT_END, 'API')
const webPort = await resolvePort(process.env.PROMPT_STUDIO_WEB_PORT, WEB_PORT_START, WEB_PORT_END, 'Web')

if (!process.env.PROMPT_STUDIO_API_PORT && apiPort !== DEFAULT_API_PORT) {
  console.log(`[dev] Port ${DEFAULT_API_PORT} is in use. Using API port ${apiPort}.`)
}
if (!process.env.PROMPT_STUDIO_WEB_PORT && webPort !== DEFAULT_WEB_PORT) {
  console.log(`[dev] Port ${DEFAULT_WEB_PORT} is in use. Using Web port ${webPort}.`)
}

console.log(`[dev] API:  http://127.0.0.1:${apiPort}/docs`)
console.log(`[dev] GUI:  http://127.0.0.1:${webPort}`)

const env = {
  ...process.env,
  PROMPT_STUDIO_API_PORT: String(apiPort),
  PROMPT_STUDIO_WEB_PORT: String(webPort),
}

const concurrentlyBin = join(root, 'node_modules', 'concurrently', 'dist', 'bin', 'concurrently.js')

const child = spawn(
  process.execPath,
  [
    concurrentlyBin,
    '-k',
    '-n',
    'api,web',
    '-c',
    'blue,green',
    'npm run dev:api',
    'node scripts/wait-api.mjs && npm run dev:web',
  ],
  { cwd: root, env, stdio: 'inherit' },
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1)
  }
  process.exit(code ?? 1)
})
