import { WebSocket, WebSocketServer } from "ws";
import { Server } from "node:http";
import type { Match } from "../types/express.js";
import { wsArcjet } from "../arcjet.js";
import { IncomingMessage } from "node:http";
import net from "node:net";

interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
}

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcast(wss: WebSocketServer, payload: unknown) {
  for (const client of wss.clients) {
    // if (client.readyState !== WebSocket.OPEN) continue;
    // client.send(JSON.stringify(payload));
    sendJson(client, payload);
  }
}

export function attachWebSocketServer(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  server.on(
    "upgrade",
    async (req: IncomingMessage, socket: net.Socket, head: Buffer) => {
      const { pathname } = new URL(req.url!, `http://${req.headers.host}`);
      if (pathname !== "/ws") {
        return;
      }

      if (wsArcjet) {
        try {
          const decision = await wsArcjet.protect(req);
          if (decision.isDenied()) {
            if (decision.reason.isRateLimit()) {
              socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
            } else {
              socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            }
            socket.destroy();
            return;
          }
        } catch (error) {
          console.error("WS upgrade protection error", error);
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
          return;
        }
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    },
  );

  wss.on("connection", async (socket: ExtendedWebSocket) => {
    // Hearbeat (PingPong)
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    sendJson(socket, { type: "welcome" });
    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) return ws.terminate();

      ws.isAlive = false;
      ws.ping();
    });
  }, 20000);
  wss.on("close", () => clearInterval(interval));
  function broadcastMatchCreated(match: Match) {
    broadcast(wss, { type: "match_created", data: match });
  }
  return { broadcastMatchCreated };
}
