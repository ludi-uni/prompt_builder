export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { attempts?: number; delayMs?: number },
): Promise<T> {
  const attempts = options?.attempts ?? 5
  const delayMs = options?.delayMs ?? 500
  let lastError: unknown

  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw lastError
}
