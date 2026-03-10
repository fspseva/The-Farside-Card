"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  useAccount,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseAbi, formatUnits, parseGwei } from "viem";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

// Circle USDC addresses per chain
const USDC_BY_CHAIN: Record<number, `0x${string}`> = {
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",   // Base Sepolia
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Eth Sepolia
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",   // Arb Sepolia
};
const USDC_ABI = parseAbi([
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
]);

interface TopUpModalProps {
  cardId: string;
  onClose: () => void;
}

type DepositStatus =
  | "idle"
  | "generating"
  | "sending"
  | "confirming"
  | "processing"
  | "completed"
  | "failed";

export function TopUpModal({ cardId, onClose }: TopUpModalProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [denomination, setDenomination] = useState<10 | 100>(10);
  const [stealthAddress, setStealthAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const stealthRef = useRef<string | null>(null);
  const relayTriggered = useRef(false);

  const usdcAddress = USDC_BY_CHAIN[chainId];

  const { writeContractAsync } = useWriteContract();

  // Read user's USDC balance
  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!usdcAddress },
  });

  // Watch for tx receipt
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // When tx confirms, auto-trigger relay
  const triggerRelay = useCallback(async () => {
    if (relayTriggered.current) return;
    relayTriggered.current = true;
    try {
      setStatus("processing");
      await fetch(`${API_URL}/api/relay/confirm-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          stealthAddress: stealthRef.current,
        }),
      });
    } catch (e) {
      console.error("Relay failed:", e);
      setStatus("failed");
      setErrorMsg("Failed to trigger relay");
    }
  }, [cardId]);

  useEffect(() => {
    if (txConfirmed && stealthRef.current && status === "confirming") {
      triggerRelay();
    }
  }, [txConfirmed, status, triggerRelay]);

  // Listen for deposit completion via WebSocket
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
          setErrorMsg("Deposit processing failed on-chain");
        }
      } catch {}
    };
    return () => ws.close();
  }, [cardId]);

  const handleDeposit = async () => {
    if (!isConnected || !address) return;
    setErrorMsg(null);
    relayTriggered.current = false;

    try {
      // Step 1: Generate stealth address from backend
      setStatus("generating");
      const res = await fetch(`${API_URL}/api/card/${cardId}/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ denomination, chainId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate stealth address");

      setStealthAddress(data.stealthAddress);
      stealthRef.current = data.stealthAddress;

      // Step 2: Transfer USDC from wallet to stealth address
      setStatus("sending");
      const hash = await writeContractAsync({
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [
          data.stealthAddress as `0x${string}`,
          BigInt(denomination) * BigInt(1_000_000),
        ],
        // Ensure gas fee is high enough for L2s like Arbitrum
        maxFeePerGas: parseGwei("0.1"),
        maxPriorityFeePerGas: parseGwei("0.01"),
      });
      setTxHash(hash);
      setStatus("confirming");
    } catch (e: any) {
      console.error("Deposit failed:", e);
      if (e.message?.includes("User rejected")) {
        setStatus("idle");
      } else {
        setStatus("failed");
        setErrorMsg(e.shortMessage || e.message || "Transaction failed");
      }
    }
  };

  const balanceStr = usdcBalance
    ? formatUnits(usdcBalance, 6)
    : "0";
  const hasEnough = usdcBalance
    ? usdcBalance >= BigInt(denomination) * BigInt(1_000_000)
    : false;

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
            {!isConnected ? (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-4">
                  Connect your wallet to deposit USDC
                </p>
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-gray-400">Select denomination:</p>
                  <p className="text-sm text-gray-500">
                    Wallet: {Number(balanceStr).toFixed(2)} USDC
                  </p>
                </div>
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
                {!hasEnough && (
                  <p className="text-amber-400 text-sm mb-3 text-center">
                    Insufficient USDC balance. Get USDC from the{" "}
                    <a
                      href="https://faucet.circle.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-amber-300"
                    >
                      Circle Faucet
                    </a>
                    .
                  </p>
                )}
                <button
                  onClick={handleDeposit}
                  disabled={!hasEnough}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600/50 rounded-lg font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Deposit ${denomination} USDC
                </button>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  USDC is sent to a stealth address, then routed through a
                  privacy pool via ZK proof
                </p>
              </>
            )}
          </>
        )}

        {status === "generating" && (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-slate-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg font-medium">Generating stealth address...</p>
          </div>
        )}

        {status === "sending" && (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-slate-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg font-medium">Confirm in your wallet</p>
            <p className="text-sm text-gray-400 mt-2">
              Sending {denomination} USDC to stealth address
            </p>
          </div>
        )}

        {status === "confirming" && (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-slate-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg font-medium">Waiting for confirmation...</p>
            <p className="text-sm text-gray-400 mt-2">
              Transaction submitted, waiting for block confirmation
            </p>
          </div>
        )}

        {status === "processing" && (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-lg font-medium">Processing ZK proof...</p>
            <p className="text-sm text-gray-400 mt-2">
              Depositing into privacy pool and generating proof. This may take a
              moment.
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

        {status === "failed" && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              &#10007;
            </div>
            <p className="text-lg font-medium text-red-400">Deposit Failed</p>
            {errorMsg && (
              <p className="text-sm text-gray-400 mt-2">{errorMsg}</p>
            )}
            <button
              onClick={() => {
                setStatus("idle");
                setErrorMsg(null);
                setTxHash(undefined);
                stealthRef.current = null;
                relayTriggered.current = false;
              }}
              className="mt-4 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
