import { logger } from "./logger";

export const STARTUP_TIMEOUTS = {
  authTotal: 9000,
  authSession: 5000,
  authProfile: 6000,
  onboardingStorage: 2500,
  serviceInit: 2500,
  notificationInit: 2500,
  pushToken: 6000,
  updatesCheck: 2500,
  updatesFetch: 4000,
  launchNotification: 1200,
  splashFallback: 7000,
};

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

export function logStartup(event: string, details?: Record<string, unknown>) {
  if (details) {
    logger.startup(`[startup] ${event}`, details);
    return;
  }

  logger.startup(`[startup] ${event}`);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function runStartupTask<T>(
  label: string,
  task: () => Promise<T>,
  timeoutMs: number,
): Promise<T>;
export async function runStartupTask<T>(
  label: string,
  task: () => Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T>;
export async function runStartupTask<T>(
  label: string,
  task: () => Promise<T>,
  timeoutMs: number,
  fallback?: T,
): Promise<T> {
  const startedAt = Date.now();
  const hasFallback = arguments.length >= 4;

  logStartup(`${label}:start`);

  try {
    const result = await withTimeout(Promise.resolve().then(task), timeoutMs, label);
    logStartup(`${label}:ok`, { ms: Date.now() - startedAt });
    return result;
  } catch (error) {
    logStartup(`${label}:failed`, {
      ms: Date.now() - startedAt,
      error: describeError(error),
    });

    if (hasFallback) return fallback as T;
    throw error;
  }
}

export function startNonBlockingStartupTask(
  label: string,
  task: () => Promise<unknown>,
  timeoutMs: number,
) {
  void runStartupTask(label, task, timeoutMs, null).catch((error) => {
    logStartup(`${label}:unhandled`, { error: describeError(error) });
  });
}
