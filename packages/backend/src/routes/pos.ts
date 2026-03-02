import { Router } from "express";
import { getCard, updateCardBalance, addTransaction } from "../db/schema.js";
import { broadcast } from "../ws/broadcast.js";

const router = Router();

// POST /api/pos/charge
router.post("/pos/charge", (req, res) => {
  try {
    const { cardId, merchant, amount, description } = req.body;

    if (!cardId || !merchant || !amount) {
      return res
        .status(400)
        .json({ error: "Missing cardId, merchant, or amount" });
    }

    const amountUnits = Math.round(amount * 1_000_000);
    const card = getCard(cardId);

    if (!card) {
      return res.status(404).json({ error: "Card not found" });
    }

    if (card.balance < amountUnits) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    updateCardBalance(cardId, -amountUnits);

    addTransaction(
      cardId,
      "purchase",
      amountUnits,
      merchant,
      description || `Purchase at ${merchant}`,
      null
    );

    const newBalance = card.balance - amountUnits;

    broadcast({ type: "balance_update", cardId, balance: newBalance });

    broadcast({
      type: "transaction",
      cardId,
      tx: {
        type: "purchase",
        amount: amountUnits,
        merchant,
        description: description || `Purchase at ${merchant}`,
        created_at: new Date().toISOString(),
      },
    });

    res.json({ success: true, balance: newBalance, merchant, amount: amountUnits });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
