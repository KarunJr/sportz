import { RawData, WebSocket, WebSocketServer } from "ws";
import { Server } from "node:http";
import type { ICommentary, IMatch } from "../types/express.js";
import { wsArcjet } from "../arcjet.js";
import { IncomingMessage } from "node:http";
import net from "node:net";

interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  subscriptions?: Set<number>;
}

interface IPayload<T = unknown> {
  type: string;
  message?: string;
  data?: T;
}

const matchSubscribers = new Map<number, Set<WebSocket>>();

function subscribe(matchId: number, socket: WebSocket) {
  /*
  // Simplified Method down one is of modiefied, both do the same task, add set of sockets in map
  if(!matchSubscribers.has(matchId)){
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId)!.add(socket)
  */
  const subscribers = matchSubscribers.get(matchId) ?? new Set();
  subscribers.add(socket);
  matchSubscribers.set(matchId, subscribers);
}

function unsubscribe(matchId: number, socket: WebSocket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupSubscribtions(socket: ExtendedWebSocket) {
  for (const matchId of socket.subscriptions!) {
    unsubscribe(matchId, socket);
  }
}

function sendJson(socket: WebSocket, payload: IPayload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcastToAll<T>(wss: WebSocketServer, payload: IPayload<T>) {
  for (const client of wss.clients) {
    // if (client.readyState !== WebSocket.OPEN) continue;
    // client.send(JSON.stringify(payload));
    sendJson(client, payload);
  }
}

function broadcastToMatch<T>(matchId: number, payload: IPayload<T>) {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function isPayload(msg: any): msg is IPayload<unknown> {
  return (
    typeof msg === "object" &&
    msg !== null &&
    typeof msg.type === "string"
  );
}
function handleMessage(socket: ExtendedWebSocket, data: RawData) {
  let parsed: unknown;
  let rawstr: string = typeof data === "string" ? data : data.toString("utf-8");

  try {
    parsed = JSON.parse(rawstr);
  } catch (error) {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
    return;
  }
  if (!isPayload(parsed)) {
    sendJson(socket, { type: "error", message: "Invalid payload structure" });
    return;
  }
  const message = parsed;

  if (message.type === "subscribe") {
    if (typeof message.data === "number" && Number.isInteger(message.data)) {
      // 'data' contains the matchId that the client wants to subscribe to.
      // We store it in socket.subscriptions so we can track which matches this client is subscribed to.
      // Later, this matchId will be used in the matchSubscribers map to broadcast updates only to subscribed clients.
      subscribe(message.data, socket);
      socket.subscriptions?.add(message.data);
      sendJson(socket, {
        type: "subscribe",
        message: `You subscribed on Match ${message.data}.`,
      });
    }
    return;
  }
  if (message.type === "unsubscribe") {
    if (typeof message.data === "number" && Number.isInteger(message.data)) {
      unsubscribe(message.data, socket);
      socket.subscriptions?.delete(message.data);
      sendJson(socket, {
        type: "unsubscribe",
        message: "You just unsubscribe this channel.",
      });
    }
    return;
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
              socket.write("HTTP/1.1 403 Good Luck\r\n\r\n");
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
    socket.subscriptions = new Set();
    sendJson(socket, { type: "connection_open", message: "Welcome to Sportz" });

    socket.on("message", (data) => {
      handleMessage(socket, data);
    });
    socket.on("error", () => {
      socket.terminate();
    });
    socket.on("close", () => {
      cleanupSubscribtions(socket);
    });
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
  function broadcastMatchCreated(match: IMatch) {
    broadcastToAll<IMatch>(wss, {
      type: "match_created",
      message: "Match created",
      data: match,
    });
  }

  function broadcastCommentary(matchId: number, comment: ICommentary) {
    broadcastToMatch<ICommentary>(matchId, {
      type: "commentary",
      message: "Comments",
      data: comment,
    });
  }
  return { broadcastMatchCreated, broadcastCommentary };
}
