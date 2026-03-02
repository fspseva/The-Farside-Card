import { Router } from "express";
import { processDeposit } from "../services/relayer.js";

const router = Router();

// POST /api/relay/confirm-deposit
router.post("/relay/confirm-deposit", async (req, res) => {
  try {
    const { cardId, stealthAddress } = req.body;

    if (!cardId || !stealthAddress) {
      return res
        .status(400)
        .json({ error: "Missing cardId or stealthAddress" });
    }

    processDeposit(cardId, stealthAddress).catch(console.error);

    res.json({ status: "processing" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
