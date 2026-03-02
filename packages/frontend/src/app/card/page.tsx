"use client";

import { useState, useEffect, useCallback } from "react";
import { CardVisual } from "../../components/CardVisual";
import { TransactionList } from "../../components/TransactionList";
import { TopUpModal } from "../../components/TopUpModal";
import { KYCForm } from "../../components/KYCForm";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useCardBalance } from "../../hooks/useCardBalance";

export default function CardPage() {
  const [cardId, setCardId] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("---- ---- ---- ----");
  const [showTopUp, setShowTopUp] = useState(false);
  const [kycComplete, setKycComplete] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("stealth-card-id");
    const storedNumber = localStorage.getItem("stealth-card-number");
    if (stored) {
      setCardId(stored);
      setKycComplete(true);
      if (storedNumber) setCardNumber(storedNumber);
    }
  }, []);

  const { card, transactions, refresh, setCard, setTransactions } =
    useCardBalance(cardId);

  const handleWsMessage = useCallback(
    (data: any) => {
      if (data.cardId !== cardId) return;

      if (data.type === "balance_update") {
        setCard((prev: any) =>
          prev ? { ...prev, balance: data.balance } : prev
        );
      }
      if (data.type === "transaction") {
        setTransactions((prev: any) => [data.tx, ...prev]);
      }
      if (data.type === "deposit_status" && data.status === "completed") {
        refresh();
      }
    },
    [cardId, refresh, setCard, setTransactions]
  );

  useWebSocket(handleWsMessage);

  const handleKycComplete = (id: string, number: string) => {
    setCardId(id);
    setCardNumber(number);
    setKycComplete(true);
    localStorage.setItem("stealth-card-id", id);
    localStorage.setItem("stealth-card-number", number);
  };

  if (!kycComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <KYCForm onComplete={handleKycComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center">My Farside Card</h1>

      <CardVisual cardNumber={cardNumber} balance={card?.balance || 0} />

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => setShowTopUp(true)}
          className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600/50 shadow-[0_0_15px_rgba(100,100,100,0.1)] rounded-lg font-medium transition"
        >
          Top Up
        </button>
        <button
          onClick={refresh}
          className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">Transactions</h2>
        <TransactionList transactions={transactions} />
      </div>

      {showTopUp && cardId && (
        <TopUpModal cardId={cardId} onClose={() => setShowTopUp(false)} />
      )}
    </div>
  );
}
