import { describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import { EmailNotificationChannel } from "../../src/modules/notifications/email-notification-channel.service";

describe("EmailNotificationChannel", () => {
  it("logs instead of sending when RESEND_API_KEY is not configured, and reports sent: false", async () => {
    const config = new ConfigService({});
    const channel = new EmailNotificationChannel(config);
    const result = await channel.send({ toUserId: "u1", toEmail: "dave@example.com", title: "Hi", body: "Test body" });
    expect(result.sent).toBe(false);
    expect(result.detail).toContain("RESEND_API_KEY not configured");
  });

  it("reports sent: false with a clear reason when the recipient has no email", async () => {
    const config = new ConfigService({});
    const channel = new EmailNotificationChannel(config);
    const result = await channel.send({ toUserId: "u1", title: "Hi", body: "Test body" });
    expect(result.sent).toBe(false);
    expect(result.detail).toContain("No email address");
  });
});
