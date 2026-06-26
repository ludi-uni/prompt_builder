const port = process.env.PROMPT_STUDIO_API_PORT ?? '61000'
const url = `http://127.0.0.1:${port}/api/health`
const timeoutMs = Number(process.env.PROMPT_STUDIO_API_WAIT_MS ?? 30000)
const intervalMs = 250

const deadline = Date.now() + timeoutMs

process.stdout.write(`[dev] Waiting for API at ${url} ...`)

while (Date.now() < deadline) {
  try {
    const response = await fetch(url)
    if (response.ok) {
      console.log(' ready')
      process.exit(0)
    }
  } catch {
    // API still starting
  }
  process.stdout.write('.')
  await new Promise((resolve) => setTimeout(resolve, intervalMs))
}

console.error(`\n[dev] API did not become ready within ${timeoutMs}ms`)
process.exit(1)
