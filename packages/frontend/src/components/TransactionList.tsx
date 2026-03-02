"use client";

interface Transaction {
  id: number;
  type: string;
  amount: number;
  merchant: string | null;
  description: string;
  created_at: string;
}

interface TransactionListProps {
  transactions: Transaction[];
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
