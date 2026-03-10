"use client";

import { useState, useCallback, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CardInfo {
  id: string;
  balance: number;
  createdAt: string;
}

interface Transaction {
  id: number;
  card_id: string;
  type: string;
  amount: number;
  merchant: string | null;
  description: string;
  tx_hash: string | null;
  chain_id: number | null;
  created_at: string;
}

export function useCardBalance(cardId: string | null) {
  const [card, setCard] = useState<CardInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCard = useCallback(async () => {
    if (!cardId) return;
    try {
      const res = await fetch(`${API_URL}/api/card/${cardId}`);
      if (res.ok) {
        const data = await res.json();
        setCard(data);
      }
    } catch (e) {
      console.error("Failed to fetch card:", e);
    }
  }, [cardId]);

  const fetchTransactions = useCallback(async () => {
    if (!cardId) return;
    try {
      const res = await fetch(`${API_URL}/api/card/${cardId}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (e) {
      console.error("Failed to fetch transactions:", e);
    }
  }, [cardId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCard(), fetchTransactions()]);
    setLoading(false);
  }, [fetchCard, fetchTransactions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { card, transactions, loading, refresh, setCard, setTransactions };
}
