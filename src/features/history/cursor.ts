import { isLocalDate, type LocalDate } from "@/lib/utils/dates";

/**
 * Opaque keyset cursor for activity history, ordered by (localDate desc, id desc).
 * Encoded as base64url("YYYY-MM-DD|<uuid>"). Pure; decoding returns null on anything malformed
 * so a tampered cursor degrades to "first page" at the boundary, never to an error or injection.
 */
export interface HistoryCursor {
  localDate: LocalDate;
  id: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeHistoryCursor(cursor: HistoryCursor): string {
  return Buffer.from(`${cursor.localDate}|${cursor.id}`, "utf8").toString("base64url");
}

export function decodeHistoryCursor(value: string | null | undefined): HistoryCursor | null {
  if (!value || value.length > 100) return null;
  try {
    const [localDate, id, ...rest] = Buffer.from(value, "base64url").toString("utf8").split("|");
    if (rest.length > 0 || !localDate || !id) return null;
    if (!isLocalDate(localDate) || !UUID_RE.test(id)) return null;
    return { localDate, id };
  } catch {
    return null;
  }
}
