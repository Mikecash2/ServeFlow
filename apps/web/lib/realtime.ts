"use client";

import { io, Socket } from "socket.io-client";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";

/**
 * Connects to the realtime namespace (docs/02-architecture.md §5) and joins
 * a church's room. The server verifies membership server-side before
 * accepting the join (see apps/api/src/modules/realtime/realtime.gateway.ts)
 * — a client can't eavesdrop on another church just by knowing its id.
 */
export function connectRealtime(accessToken: string, churchId: string): Socket {
  const socket = io(`${WS_BASE}/realtime`, {
    auth: { token: accessToken },
    transports: ["websocket"],
  });
  socket.on("connect", () => {
    socket.emit("join", { churchId });
  });
  return socket;
}
