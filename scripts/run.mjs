import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const isWin = process.platform === 'win32'

const task = process.argv[2]
const tasks = {
  setup: isWin ? 'setup.ps1' : 'setup.sh',
  'dev-backend': isWin ? 'dev-backend.ps1' : 'dev-backend.sh',
  'dev-frontend': isWin ? 'dev-frontend.ps1' : 'dev-frontend.sh',
  test: isWin ? 'test.ps1' : 'test.sh',
  llama: isWin ? 'llama.ps1' : 'llama.sh',
  lint: isWin ? 'lint.ps1' : 'lint.sh',
  format: isWin ? 'format.ps1' : 'format.sh',
  'format-check': isWin ? 'format-check.ps1' : 'format-check.sh',
}

const script = tasks[task]
if (!script) {
  console.error(`Unknown task: ${task}`)
  process.exit(1)
}

const scriptPath = join(__dirname, script)
if (!existsSync(scriptPath)) {
  console.error(`Script not found: ${scriptPath}`)
  process.exit(1)
}

const result = isWin
  ? spawnSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...process.argv.slice(3)],
      { cwd: root, stdio: 'inherit', shell: false },
    )
  : spawnSync('bash', [scriptPath, ...process.argv.slice(3)], { cwd: root, stdio: 'inherit' })

process.exit(result.status ?? 1)
