import { Router } from "express";
import crypto from "crypto";
import * as secp from "@noble/secp256k1";
import { bytesToHex } from "viem";
import {
  generateStealthKeys,
  encodeStealthMetaAddress,
  toStealthMetaAddress,
  generateStealthAddress,
} from "@stealth-card/sdk";
import {
  createCard,
  getCard,
  getTransactions,
  createDeposit,
} from "../db/schema.js";
import { broadcast } from "../ws/broadcast.js";
import { poseidonHash2 } from "../services/poseidon.js";

const router = Router();

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

// POST /api/card/create
router.post("/card/create", async (req, res) => {
  try {
    const cardId = crypto.randomUUID();
    const keys = generateStealthKeys();
    const meta = toStealthMetaAddress(keys);
    const metaUri = encodeStealthMetaAddress(meta);

    await createCard(
      cardId,
      bytesToHex(keys.spendingPubKey),
      bytesToHex(keys.viewingKey),
      bytesToHex(keys.spendingKey),
      metaUri
    );

    const cardNumber = `4242 ${Math.random().toString().slice(2, 6)} ${Math.random().toString().slice(2, 6)} ${Math.random().toString().slice(2, 6)}`;

    res.json({ cardId, cardNumber, stealthMetaAddress: metaUri });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/card/:id
router.get("/card/:id", async (req, res) => {
  try {
    const card = await getCard(req.params.id);
    if (!card) return res.status(404).json({ error: "Card not found" });
    res.json({
      id: card.id,
      balance: card.balance,
      createdAt: card.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/card/:id/transactions
router.get("/card/:id/transactions", async (req, res) => {
  try {
    const txs = await getTransactions(req.params.id);
    res.json(txs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/card/:id/topup
router.post("/card/:id/topup", async (req, res) => {
  try {
    const card = await getCard(req.params.id);
    if (!card) return res.status(404).json({ error: "Card not found" });

    const { denomination, chainId = 84532 } = req.body;
    if (denomination !== 10 && denomination !== 100) {
      return res.status(400).json({ error: "Denomination must be 10 or 100" });
    }

    const nullifier = BigInt("0x" + crypto.randomBytes(31).toString("hex"));
    const secret = BigInt("0x" + crypto.randomBytes(31).toString("hex"));

    // Build stealth meta from stored keys
    const viewingPrivKey = hexToBytes(card.viewing_priv_key);
    const viewingPubKey = secp.getPublicKey(viewingPrivKey, true);

    const meta = {
      spendingPubKey: hexToBytes(card.spending_pub_key),
      viewingPubKey,
    };
    const { stealthAddress, ephemeralPubKey, viewTag } =
      generateStealthAddress(meta);

    const commitment = poseidonHash2(nullifier, secret);
    const commitmentStr = commitment.toString();

    await createDeposit(
      card.id,
      commitmentStr,
      nullifier.toString(),
      secret.toString(),
      stealthAddress,
      bytesToHex(ephemeralPubKey),
      viewTag,
      chainId,
      denomination * 1_000_000
    );

    res.json({
      stealthAddress,
      denomination,
      chainId,
      status: "waiting_for_deposit",
    });

    broadcast({
      type: "deposit_status",
      cardId: card.id,
      status: "waiting_for_deposit",
      stealthAddress,
      denomination,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
