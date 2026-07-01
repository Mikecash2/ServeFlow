/**
 * docs/02-architecture.md §8: a single interface every channel implements,
 * so the messaging/scheduling business logic never talks to Resend, FCM,
 * Twilio, etc. directly — only to this contract. Turning on a real
 * provider later means implementing this interface and changing one
 * binding in notifications.module.ts, not touching call sites.
 */
export interface SendNotificationParams {
  toEmail?: string;
  toUserId: string;
  title: string;
  body: string;
}

export interface NotificationChannel {
  send(params: SendNotificationParams): Promise<{ sent: boolean; detail: string }>;
}

export const EMAIL_CHANNEL = Symbol("EMAIL_CHANNEL");
export const PUSH_CHANNEL = Symbol("PUSH_CHANNEL");
export const SMS_CHANNEL = Symbol("SMS_CHANNEL");
export const WHATSAPP_CHANNEL = Symbol("WHATSAPP_CHANNEL");
