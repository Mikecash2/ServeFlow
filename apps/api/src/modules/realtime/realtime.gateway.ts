import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { MembershipsRepository } from "../rbac/memberships.repository";
import { JwtAccessPayload } from "../auth/auth.types";

/**
 * Realtime channel from docs/02-architecture.md §5. Clients connect to the
 * `/realtime` namespace with their access token, then explicitly `join` a
 * church room — joining is membership-checked server-side so a client can't
 * eavesdrop on another church's events just by guessing a churchId.
 *
 * Deviation from the architecture doc: no Redis pub/sub adapter, so this
 * only fans out events to clients connected to *this* process. Fine for a
 * single-instance deployment (and for this sandbox, which has no Redis
 * available anyway — see serveflow/README.md); horizontal scaling needs the
 * `@socket.io/redis-adapter` package wired in here, which is additive, not
 * a rework, once Redis exists.
 */
@WebSocketGateway({ namespace: "/realtime", cors: { origin: "*" } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger("RealtimeGateway");

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly memberships: MembershipsRepository,
  ) {}

  async handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token as string) ?? (client.handshake.query?.token as string);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtAccessPayload>(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      });
      if (payload.type !== "access") throw new Error("not an access token");
      client.data.userId = payload.sub;
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage("join")
  async handleJoin(client: Socket, payload: { churchId: string }) {
    const userId: string | undefined = client.data.userId;
    if (!userId || !payload?.churchId) return { joined: false };

    const userMemberships = await this.memberships.findActiveByUserIdUnscoped(userId);
    const belongs = userMemberships.some((m) => m.churchId === payload.churchId);
    if (!belongs) {
      this.logger.warn(`User ${userId} attempted to join church:${payload.churchId} without membership`);
      return { joined: false };
    }

    await client.join(`church:${payload.churchId}`);
    return { joined: true };
  }

  emitTaskUpdated(churchId: string, task: unknown) {
    this.server?.to(`church:${churchId}`).emit("task.updated", task);
  }

  emitCoverageChanged(churchId: string, payload: unknown) {
    this.server?.to(`church:${churchId}`).emit("coverage.changed", payload);
  }

  emitEquipmentFault(churchId: string, payload: unknown) {
    this.server?.to(`church:${churchId}`).emit("equipment.fault_reported", payload);
  }

  emitCheckinRecorded(churchId: string, payload: unknown) {
    this.server?.to(`church:${churchId}`).emit("checkin.recorded", payload);
  }
}
