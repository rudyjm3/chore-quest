/**
 * Application error model shared by services, server actions and route handlers.
 * Services throw `AppError`; the boundary (action/route) converts it into an
 * `ActionResult` or an HTTP response via `toErrorResponse`.
 */
export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INVALID_STATE"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  INVALID_STATE: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(code: AppErrorCode, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }

  static unauthorized(message = "Sign in required") {
    return new AppError("UNAUTHORIZED", message);
  }
  static forbidden(message = "You do not have access to this resource") {
    return new AppError("FORBIDDEN", message);
  }
  static notFound(entity = "Resource") {
    return new AppError("NOT_FOUND", `${entity} not found`);
  }
  static validation(message: string, details?: Record<string, string[]>) {
    return new AppError("VALIDATION", message, details);
  }
  static conflict(message: string) {
    return new AppError("CONFLICT", message);
  }
  static invalidState(message: string) {
    return new AppError("INVALID_STATE", message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Shape returned by every server action. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: AppErrorCode; message: string; details?: Record<string, string[]> };
    };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: unknown): ActionResult<T> {
  if (isAppError(error)) {
    return {
      ok: false,
      error: { code: error.code, message: error.message, details: error.details },
    };
  }
  // Never leak internal error details to the client.
  console.error("[action] unexpected error", error);
  return {
    ok: false,
    error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
  };
}

/** Wrap a server action body so thrown AppErrors become typed results. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn());
  } catch (error) {
    // Next.js uses thrown errors for redirect()/notFound(); let those through.
    if (isNextNavigationError(error)) throw error;
    return fail(error);
  }
}

function isNextNavigationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}
