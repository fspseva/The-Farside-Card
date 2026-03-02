"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface KYCFormProps {
  onComplete: (cardId: string, cardNumber: string) => void;
}

export function KYCForm({ onComplete }: KYCFormProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/card/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      onComplete(data.cardId, data.cardNumber);
    } catch (error) {
      console.error("Failed to create card:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6">Identity Verification</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Full Name</label>
          <input
            type="text"
            defaultValue="John Doe"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Email</label>
          <input
            type="email"
            defaultValue="john@example.com"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Address</label>
          <input
            type="text"
            defaultValue="123 Privacy Lane, Crypto City"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Date of Birth
          </label>
          <input
            type="text"
            defaultValue="01/01/1990"
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-slate-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-gray-700 border border-slate-600/50 rounded-lg font-medium transition mt-6"
        >
          {loading ? "Verifying..." : "Submit KYC"}
        </button>
        <p className="text-xs text-gray-500 text-center">
          This is a demo — all fields are pre-filled. Just click Submit.
        </p>
      </form>
    </div>
  );
}
