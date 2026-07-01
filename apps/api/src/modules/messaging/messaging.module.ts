import { Module } from "@nestjs/common";
import { MessagingController } from "./messaging.controller";
import { ChannelsRepository } from "./channels.repository";
import { MessagesRepository } from "./messages.repository";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [MessagingController],
  providers: [ChannelsRepository, MessagesRepository],
})
export class MessagingModule {}
