import net from 'node:net'

export function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, host)
  })
}

export async function findFreePort(start, end, host = '127.0.0.1') {
  for (let port = start; port <= end; port += 1) {
    if (await isPortFree(port, host)) {
      return port
    }
  }
  throw new Error(`No free port found in range ${start}-${end} on ${host}`)
}

export async function resolvePort(envValue, start, end, label) {
  if (envValue) {
    const port = Number(envValue)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid ${label} port: ${envValue}`)
    }
    if (!(await isPortFree(port))) {
      throw new Error(
        `${label} port ${port} is already in use. Stop the other process or set a different port.`,
      )
    }
    return port
  }
  return findFreePort(start, end)
}
