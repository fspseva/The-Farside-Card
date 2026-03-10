"use client";

interface CardVisualProps {
  cardNumber: string;
  balance: number;
  name?: string;
}

export function CardVisual({
  cardNumber,
  balance,
  name = "CARD HOLDER",
}: CardVisualProps) {
  const formattedBalance = (balance / 1_000_000).toFixed(2);

  return (
    <div className="relative w-full max-w-md aspect-[1.586/1] rounded-2xl bg-gradient-to-br from-gray-900 via-slate-800 to-black p-6 shadow-[0_0_30px_rgba(100,100,100,0.15)] border border-slate-700/50">
      <div className="flex flex-col justify-between h-full">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.25em] font-medium">
              Stealth Crypto Card
            </p>
            <p className="text-2xl font-bold text-white/90 mt-1">${formattedBalance}</p>
          </div>
          <div className="text-right">
            <svg
              className="w-10 h-10 text-white/30"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-3.5-2.5c1.17.83 2.59 1.31 3.5 1.31s2.33-.48 3.5-1.31C14.67 16.17 13.42 15.5 12 15.5s-2.67.67-3.5 1.5zM7.5 12c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5z" opacity="0" />
              <circle cx="12" cy="12" r="9" opacity="0.3" />
              <circle cx="12" cy="12" r="5" opacity="0.2" />
              <path d="M17 12c0-2.76-2.24-5-5-5v10c2.76 0 5-2.24 5-5z" opacity="0.5" />
            </svg>
          </div>
        </div>

        <div>
          <p className="text-lg tracking-[0.2em] font-mono text-white/70">{cardNumber}</p>
          <div className="flex justify-between items-end mt-2">
            <p className="text-sm text-white/50 uppercase">{name}</p>
            <p className="text-xs text-white/30">PRIVACY POOL</p>
          </div>
        </div>
      </div>
    </div>
  );
}
