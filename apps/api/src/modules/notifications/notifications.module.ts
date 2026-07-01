import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsRepository } from "./notifications.repository";
import { NotificationsService } from "./notifications.service";
import { EmailNotificationChannel } from "./email-notification-channel.service";
import { EMAIL_CHANNEL, PUSH_CHANNEL, SMS_CHANNEL, WHATSAPP_CHANNEL } from "./notification-channel.interface";
import { PushNotificationChannel, SmsNotificationChannel, WhatsAppNotificationChannel } from "./stub-notification-channel.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsRepository,
    NotificationsService,
    { provide: EMAIL_CHANNEL, useClass: EmailNotificationChannel },
    { provide: PUSH_CHANNEL, useClass: PushNotificationChannel },
    { provide: SMS_CHANNEL, useClass: SmsNotificationChannel },
    { provide: WHATSAPP_CHANNEL, useClass: WhatsAppNotificationChannel },
  ],
  exports: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
