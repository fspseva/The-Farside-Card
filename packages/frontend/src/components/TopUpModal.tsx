"use client";

import { useState, useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

interface TopUpModalProps {
  cardId: string;
  onClose: () => void;
}

type DepositStatus =
  | "idle"
  | "waiting"
  | "detected"
  | "processing"
  | "completed"
  | "failed";

export function TopUpModal({ cardId, onClose }: TopUpModalProps) {
  const [denomination, setDenomination] = useState<10 | 100>(10);
  const [stealthAddress, setStealthAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [copied, setCopied] = useState(false);
  const stealthRef = useRef<string | null>(null);

  // Listen for this deposit's completion via WebSocket
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.cardId !== cardId) return;
        if (data.type !== "deposit_status") return;
        if (data.stealthAddress !== stealthRef.current) return;

        if (data.status === "completed") {
          setStatus("completed");
        } else if (data.status === "failed") {
          setStatus("failed");
        }
      } catch {}
    };
    return () => ws.close();
  }, [cardId]);

  const handleTopUp = async () => {
    try {
      const res = await fetch(`${API_URL}/api/card/${cardId}/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ denomination }),
      });
      const data = await res.json();
      setStealthAddress(data.stealthAddress);
      stealthRef.current = data.stealthAddress;
      setStatus("waiting");
    } catch (e) {
      console.error("Failed to initiate top-up:", e);
    }
  };

  const handleCopy = async () => {
    if (stealthAddress) {
      await navigator.clipboard.writeText(stealthAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmDeposit = async () => {
    if (!stealthAddress) return;
    setStatus("detected");

    try {
      await fetch(`${API_URL}/api/relay/confirm-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, stealthAddress }),
      });
      setStatus("processing");
    } catch (e) {
      console.error("Failed to confirm deposit:", e);
      setStatus("failed");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Top Up Card</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        {status === "idle" && (
          <>
            <p className="text-gray-400 mb-4">Select denomination:</p>
            <div className="flex gap-3 mb-6">
              {([10, 100] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDenomination(d)}
                  className={`flex-1 py-3 rounded-lg font-bold text-lg border-2 transition ${
                    denomination === d
                      ? "border-slate-500 bg-slate-500/20 text-slate-200 shadow-[0_0_10px_rgba(100,100,100,0.15)]"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  ${d}
                </button>
              ))}
            </div>
            <button
              onClick={handleTopUp}
              className="w-full py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600/50 rounded-lg font-medium transition"
            >
              Generate Stealth Address
            </button>
          </>
        )}

        {status === "waiting" && stealthAddress && (
          <>
            <p className="text-gray-400 mb-2">
              Send{" "}
              <span className="text-white font-bold">{denomination} USDC</span>{" "}
              to:
            </p>
            <div className="bg-gray-800 rounded-lg p-3 mb-4">
              <p className="font-mono text-sm break-all text-slate-300">
                {stealthAddress}
              </p>
            </div>
            <button
              onClick={handleCopy}
              className="w-full py-2 mb-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition"
            >
              {copied ? "Copied!" : "Copy Address"}
            </button>
            <button
              onClick={handleConfirmDeposit}
              className="w-full py-3 bg-green-800 hover:bg-green-700 border border-green-700/50 rounded-lg font-medium transition"
            >
              I&apos;ve Sent the USDC
            </button>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Send from any wallet — the link is broken by the privacy pool
            </p>
          </>
        )}

        {(status === "detected" || status === "processing") && (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-slate-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg font-medium">
              {status === "detected"
                ? "Deposit detected..."
                : "Processing ZK proof..."}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              This may take a moment
            </p>
          </div>
        )}

        {status === "completed" && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              &#10003;
            </div>
            <p className="text-lg font-medium text-green-400">
              Balance Updated!
            </p>
            <p className="text-sm text-gray-400 mt-2">
              ${denomination}.00 has been added to your card
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
