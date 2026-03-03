import express from "express";
import cors from "cors";
import http from "http";
import dotenv from "dotenv";
import { initWebSocket } from "./ws/broadcast.js";
import balanceRouter from "./routes/balance.js";
import posRouter from "./routes/pos.js";
import relayRouter from "./routes/relay.js";
import { initPoseidon } from "./services/poseidon.js";
import { syncMerkleTreesFromChain } from "./services/merkleTree.js";
import { initDb } from "./db/schema.js";

dotenv.config({ path: "../../.env" });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api", balanceRouter);
app.use("/api", posRouter);
app.use("/api", relayRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

async function start() {
  // Initialize Neon Postgres
  await initDb();

  // Initialize Poseidon hash (must complete before any routes use it)
  await initPoseidon();

  // Sync Merkle trees from on-chain Deposit events
  await syncMerkleTreesFromChain();

  const server = http.createServer(app);
  initWebSocket(server);

  server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
