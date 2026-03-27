import { z } from "zod";
import { WEBHOOK_EVENT_TYPES } from "../services/webhookEventTypes";

const WebhookEventTypeSchema = z.enum(WEBHOOK_EVENT_TYPES);

export const UpdateWebhookSchema = z.object({
  webhookUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" ? null : value)),
  eventTypes: z.array(WebhookEventTypeSchema).optional(),
});

export type UpdateWebhookRequest = z.infer<typeof UpdateWebhookSchema>;
