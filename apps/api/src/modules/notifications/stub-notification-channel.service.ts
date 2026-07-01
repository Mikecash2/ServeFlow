import { Injectable, Logger } from "@nestjs/common";
import { NotificationChannel, SendNotificationParams } from "./notification-channel.interface";

/**
 * No-op stand-ins for FCM push, Twilio SMS, and WhatsApp Business API
 * (docs/08-roadmap.md "Deferred Past v1 GA"). They implement the same
 * interface as the real email channel so the messaging module's calling
 * code is provider-agnostic — swapping one of these for a real
 * implementation later doesn't change anything except this one file.
 */
@Injectable()
export class StubNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger("StubNotificationChannel");

  constructor(private readonly label: string) {}

  async send(params: SendNotificationParams): Promise<{ sent: boolean; detail: string }> {
    this.logger.log(`[stub:${this.label}] Would notify user ${params.toUserId}: "${params.title}"`);
    return { sent: false, detail: `${this.label} is not yet wired up — logged instead of sent` };
  }
}

@Injectable()
export class PushNotificationChannel extends StubNotificationChannel {
  constructor() {
    super("FCM push");
  }
}

@Injectable()
export class SmsNotificationChannel extends StubNotificationChannel {
  constructor() {
    super("SMS");
  }
}

@Injectable()
export class WhatsAppNotificationChannel extends StubNotificationChannel {
  constructor() {
    super("WhatsApp");
  }
}
