import { Inject, Injectable } from "@nestjs/common";
import { NotificationsRepository } from "./notifications.repository";
import { UsersRepository } from "../auth/users.repository";
import { EMAIL_CHANNEL, NotificationChannel } from "./notification-channel.interface";

/**
 * Every notification is recorded (audit trail of what ServeFlow tried to
 * tell someone and when) regardless of whether the underlying channel
 * actually delivered it — `sentAt` stays null if delivery failed or was
 * stubbed, so "we have a record we tried" and "it definitely arrived" stay
 * distinguishable.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly notifications: NotificationsRepository,
    private readonly users: UsersRepository,
    @Inject(EMAIL_CHANNEL) private readonly emailChannel: NotificationChannel,
  ) {}

  async notifyByEmail(params: { churchId: string; userId: string; title: string; body: string }): Promise<void> {
    const notification = await this.notifications.create({
      churchId: params.churchId,
      userId: params.userId,
      channel: "EMAIL",
      title: params.title,
      body: params.body,
    });

    const user = await this.users.findById(params.userId);
    const result = await this.emailChannel.send({
      toUserId: params.userId,
      toEmail: user?.email,
      title: params.title,
      body: params.body,
    });

    if (result.sent) {
      await this.notifications.markSent(params.churchId, notification.id);
    }
  }
}
