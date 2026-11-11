import { AppError } from "@/lib/errors";

/** Apply a ledger amount to a balance, refusing to go negative. */
export function applyLedgerAmount(balance: number, amount: number): number {
  if (!Number.isInteger(amount) || amount === 0) {
    throw AppError.validation("Ledger amount must be a non-zero integer");
  }
  const next = balance + amount;
  if (next < 0) {
    throw AppError.invalidState(`Insufficient balance: have ${balance}, need ${-amount}`);
  }
  return next;
}

/** Points a child receives for an approved occurrence (snapshot wins over live config). */
export function pointsForOccurrence(pointsSnapshot: number): number {
  return Math.max(0, pointsSnapshot);
}

/** Points for a completed routine run: bonus only (step tasks are not separately awarded). */
export function pointsForRoutineRun(bonusPointsSnapshot: number): number {
  return Math.max(0, bonusPointsSnapshot);
}
