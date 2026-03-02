"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const merchants = [
  { name: "Coffee Shop", amount: 0.50, icon: "C" },
  { name: "Grocery Store", amount: 1.25, icon: "G" },
  { name: "Online Gaming", amount: 0.75, icon: "O" },
  { name: "Shoe Store", amount: 2.00, icon: "S" },
  { name: "Restaurant", amount: 1.50, icon: "R" },
  { name: "Gas Station", amount: 3.00, icon: "F" },
];

export default function POSPage() {
  const [cardId, setCardId] = useState<string>("");
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = localStorage.getItem("stealth-card-id");
    if (stored) setCardId(stored);
  }, []);

  const handleCharge = async (merchant: string, amount: number) => {
    if (!cardId) {
      setFeedback({ [merchant]: "No card linked!" });
      setTimeout(() => setFeedback({}), 2000);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/pos/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, merchant, amount }),
      });

      if (res.ok) {
        setFeedback({ [merchant]: "Charged!" });
      } else {
        const data = await res.json();
        setFeedback({ [merchant]: data.error || "Failed" });
      }
    } catch {
      setFeedback({ [merchant]: "Error" });
    }

    setTimeout(() => setFeedback({}), 2000);
  };

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-center">POS Terminal</h1>
      <p className="text-gray-400 text-center mb-6">
        Tap a merchant to charge the card
      </p>

      {!cardId && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 text-center">
          <p className="text-yellow-400 text-sm">
            No card linked. Open the Card App first and complete KYC.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {merchants.map((m) => (
          <button
            key={m.name}
            onClick={() => handleCharge(m.name, m.amount)}
            className={`p-6 rounded-xl border-2 transition-all duration-200 ${
              feedback[m.name] === "Charged!"
                ? "border-green-600/50 bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                : feedback[m.name]
                  ? "border-red-500 bg-red-500/10"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-800"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-slate-700/50 text-slate-300 flex items-center justify-center text-lg font-bold mb-2">
              {m.icon}
            </div>
            <p className="font-medium">{m.name}</p>
            <p className="text-xl font-bold text-slate-300 mt-1">
              ${m.amount.toFixed(2)}
            </p>
            {feedback[m.name] && (
              <p
                className={`text-sm mt-2 font-medium ${
                  feedback[m.name] === "Charged!"
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {feedback[m.name]}
              </p>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>Card ID: {cardId || "Not linked"}</p>
        <p className="mt-1">
          Open /card in another window to see real-time updates
        </p>
      </div>
    </div>
  );
}
