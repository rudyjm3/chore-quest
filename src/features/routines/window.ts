import { addDays, localDateTimeToInstant, type LocalDate } from "@/lib/utils/dates";

/**
 * Completion windows (pure, no I/O).
 *
 * A routine assignment may restrict when steps can be completed to a household-local
 * time-of-day range on the run's local date, e.g. 06:00–09:00. If the end is not after the start
 * (e.g. 20:00–06:00) the window is overnight and ends on the following local day.
 * Both bounds are inclusive. No window (either bound missing) means "any time that day".
 */
export interface CompletionWindow {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export function windowOf(
  start: string | null | undefined,
  end: string | null | undefined,
): CompletionWindow | null {
  return start && end ? { start, end } : null;
}

/** The [opens, closes] instants of a run's window. */
export function windowInstants(window: CompletionWindow, localDate: LocalDate, timeZone: string) {
  const opens = localDateTimeToInstant(localDate, window.start, timeZone);
  const closeDate = window.end <= window.start ? addDays(localDate, 1) : localDate;
  const closes = localDateTimeToInstant(closeDate, window.end, timeZone);
  return { opens, closes };
}

export type WindowCheck =
  { open: true } | { open: false; reason: "too-early" | "too-late"; opens: string; closes: string };

export function checkCompletionWindow(params: {
  now: Date;
  localDate: LocalDate;
  window: CompletionWindow | null;
  timeZone: string;
}): WindowCheck {
  if (!params.window) return { open: true };
  const { opens, closes } = windowInstants(params.window, params.localDate, params.timeZone);
  if (params.now < opens) {
    return {
      open: false,
      reason: "too-early",
      opens: params.window.start,
      closes: params.window.end,
    };
  }
  if (params.now > closes) {
    return {
      open: false,
      reason: "too-late",
      opens: params.window.start,
      closes: params.window.end,
    };
  }
  return { open: true };
}
