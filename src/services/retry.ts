interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export const retryAsync = async <T>(
  operation: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> => {
  const attempts = Math.max(1, options?.attempts ?? 3);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? 600);
  const maxDelayMs = Math.max(baseDelayMs, options?.maxDelayMs ?? 6_000);
  const jitterMs = Math.max(0, options?.jitterMs ?? 250);

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < attempts &&
        (options?.shouldRetry ? options.shouldRetry(error, attempt) : true);
      if (!canRetry) {
        break;
      }
      const exponentialDelay = Math.min(
        maxDelayMs,
        baseDelayMs * 2 ** (attempt - 1),
      );
      const jitter =
        jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
      await delay(exponentialDelay + jitter);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Operation failed after retries.");
};
