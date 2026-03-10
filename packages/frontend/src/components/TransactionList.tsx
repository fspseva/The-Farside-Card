"use client";

interface Transaction {
  id: number;
  type: string;
  amount: number;
  merchant: string | null;
  description: string;
  tx_hash: string | null;
  chain_id: number | null;
  created_at: string;
}

interface TransactionListProps {
  transactions: Transaction[];
}

const EXPLORER_BY_CHAIN: Record<number, string> = {
  84532: "https://sepolia.basescan.org/tx/",
  11155111: "https://sepolia.etherscan.io/tx/",
  421614: "https://sepolia.arbiscan.io/tx/",
};

function ExplorerLink({ txHash, chainId }: { txHash: string; chainId: number | null }) {
  const baseUrl = chainId ? EXPLORER_BY_CHAIN[chainId] : null;
  if (!baseUrl) return null;

  return (
    <a
      href={`${baseUrl}${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center text-gray-400 hover:text-white transition ml-1"
      title="View on block explorer"
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}

export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No transactions yet. Top up your card to get started!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx.id || tx.created_at}
          className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                tx.type === "deposit"
                  ? "bg-green-900/30 text-green-500"
                  : "bg-red-900/30 text-red-500"
              }`}
            >
              {tx.type === "deposit" ? "+" : "-"}
            </div>
            <div>
              <p className="text-sm font-medium">
                {tx.merchant ||
                  (tx.type === "deposit" ? "Top Up" : "Purchase")}
                {tx.type === "deposit" && tx.tx_hash && (
                  <ExplorerLink txHash={tx.tx_hash} chainId={tx.chain_id} />
                )}
              </p>
              <p className="text-xs text-gray-400">{tx.description}</p>
            </div>
          </div>
          <div className="text-right">
            <p
              className={`font-mono text-sm ${
                tx.type === "deposit" ? "text-green-500" : "text-red-500"
              }`}
            >
              {tx.type === "deposit" ? "+" : "-"}$
              {(tx.amount / 1_000_000).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(tx.created_at).toLocaleTimeString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
