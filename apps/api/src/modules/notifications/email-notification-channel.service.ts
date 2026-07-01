import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { NotificationChannel, SendNotificationParams } from "./notification-channel.interface";

/**
 * Real Resend integration when RESEND_API_KEY is configured. This sandbox
 * has no Resend account (nothing to configure it with), so without a key
 * this falls back to logging the "would-have-sent" email instead of
 * throwing — the same code path either way, so wiring in a real key on a
 * normal deployment is just setting an env var, not a code change.
 */
@Injectable()
export class EmailNotificationChannel implements NotificationChannel {
  private readonly logger = new Logger("EmailNotificationChannel");
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async send(params: SendNotificationParams): Promise<{ sent: boolean; detail: string }> {
    if (!params.toEmail) {
      return { sent: false, detail: "No email address on file for this user" };
    }

    if (!this.resend) {
      this.logger.log(`[stub] Would send email to ${params.toEmail}: "${params.title}" — ${params.body}`);
      return { sent: false, detail: "RESEND_API_KEY not configured — logged instead of sent" };
    }

    try {
      await this.resend.emails.send({
        from: this.config.get<string>("RESEND_FROM_ADDRESS") ?? "ServeFlow <notifications@serveflow.app>",
        to: params.toEmail,
        subject: params.title,
        text: params.body,
      });
      return { sent: true, detail: "Sent via Resend" };
    } catch (err) {
      this.logger.error(`Failed to send email via Resend: ${(err as Error).message}`);
      return { sent: false, detail: `Resend error: ${(err as Error).message}` };
    }
  }
}
