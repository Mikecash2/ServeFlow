import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PermissionGuard } from "../rbac/permission.guard";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ChannelsRepository } from "./channels.repository";
import { MessagesRepository } from "./messages.repository";
import { MembershipsRepository } from "../rbac/memberships.repository";
import { NotificationsService } from "../notifications/notifications.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { createChannelSchema, CreateChannelDto } from "./dto/create-channel.dto";
import { sendMessageSchema, SendMessageDto } from "./dto/send-message.dto";

@Controller("churches/:churchId/channels")
@UseGuards(PermissionGuard)
export class MessagingController {
  constructor(
    private readonly channels: ChannelsRepository,
    private readonly messages: MessagesRepository,
    private readonly memberships: MembershipsRepository,
    private readonly notifications: NotificationsService,
  ) {}

  private isAdmin(user: AuthenticatedUser, churchId: string): boolean {
    return user.memberships.some(
      (m) => m.churchId === churchId && (m.role === "CHURCH_ADMIN" || m.role === "CAMPUS_ADMIN"),
    );
  }

  @Get()
  @RequirePermission({ resource: "message", action: "read" })
  async listChannels(@Param("churchId") churchId: string, @CurrentUser() user: AuthenticatedUser) {
    const ministryIds = await this.memberships.listMinistryIdsForUser(churchId, user.id);
    return this.channels.listVisible(churchId, ministryIds, this.isAdmin(user, churchId));
  }

  @Post()
  @RequirePermission({ resource: "message", action: "write" })
  async createChannel(
    @Param("churchId") churchId: string,
    @Body(new ZodValidationPipe(createChannelSchema)) dto: CreateChannelDto,
  ) {
    return this.channels.create({ churchId, ...dto });
  }

  @Get(":channelId/messages")
  @RequirePermission({ resource: "message", action: "read" })
  async listMessages(
    @Param("churchId") churchId: string,
    @Param("channelId") channelId: string,
    @Query("before") before?: string,
  ) {
    const channel = await this.channels.findById(churchId, channelId);
    if (!channel) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Channel not found" } });
    return this.messages.listForChannel(churchId, channelId, before);
  }

  @Post(":channelId/messages")
  @RequirePermission({ resource: "message", action: "write" })
  async sendMessage(
    @Param("churchId") churchId: string,
    @Param("channelId") channelId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const channel = await this.channels.findById(churchId, channelId);
    if (!channel) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Channel not found" } });

    const message = await this.messages.send({ churchId, channelId, senderId: user.id, ...dto });

    // Phase 8 exit criteria: announcing to a ministry channel emails its members.
    if (channel.type === "ANNOUNCEMENT" && channel.ministryId) {
      const recipientUserIds = await this.memberships.listUserIdsForMinistry(churchId, channel.ministryId);
      await Promise.all(
        recipientUserIds
          .filter((id) => id !== user.id)
          .map((userId) =>
            this.notifications.notifyByEmail({
              churchId,
              userId,
              title: `New announcement: ${channel.name ?? "Ministry channel"}`,
              body: dto.body,
            }),
          ),
      );
    }

    return message;
  }

  @Post("messages/:messageId/read")
  @RequirePermission({ resource: "message", action: "read" })
  async markRead(
    @Param("churchId") churchId: string,
    @Param("messageId") messageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.messages.markRead(churchId, messageId, user.id);
    return { success: true };
  }
}
