import { z } from "zod";

import { uuidSchema } from "./common";

export const markNotificationsReadSchema = z.object({
  /** Omit to mark everything read. */
  ids: z.array(uuidSchema).max(100).optional(),
});
