type LogMethod = (...args: unknown[]) => void;

const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : false;

function devOnly(method: LogMethod): LogMethod {
  return (...args) => {
    if (isDev) method(...args);
  };
}

export const logger = {
  // Startup logs are intentionally available in production logcat.
  startup: console.log.bind(console),
  // Debug/info only in dev
  debug: devOnly(console.debug.bind(console)),
  info: devOnly(console.info.bind(console)),
  // Warn/error always log in production for diagnostics
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};
