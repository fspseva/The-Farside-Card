import { WebSocketServer, WebSocket } from "ws";

let wss: WebSocketServer;

export function initWebSocket(server: any) {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");
    ws.on("close", () => console.log("WebSocket client disconnected"));
  });

  return wss;
}

export function broadcast(data: any) {
  if (!wss) return;
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
