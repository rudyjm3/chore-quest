/**
 * Minimal structured logger. Replace the sink (console) with a provider later
 * without touching call sites. Never log secrets, tokens, PINs, or child PII.
 */
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, fields?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = { level, message, time: new Date().toISOString(), ...fields };
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(JSON.stringify(line));
}

export const log = {
  debug: (message: string, fields?: Record<string, unknown>) => emit("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => emit("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit("error", message, fields),
};
