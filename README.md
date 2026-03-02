# The Farside Card

Privacy-preserving crypto card powered by stealth addresses (ERC-5564 + ERC-6538) and a ZK privacy pool (Groth16).

**The protocol never sees which wallet funded the card.** Users deposit into a Tornado Cash-style pool via stealth addresses, and withdraw with a zero-knowledge proof that breaks the on-chain link between depositor and cardholder.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Frontend    │────▶│  Backend    │────▶│  Base Sepolia     │
│  Next.js 15  │ ws  │  Express    │     │  StealthPool      │
│  RainbowKit  │◀────│  SQLite     │     │  ERC-5564/6538    │
└─────────────┘     │  snarkjs    │     │  Groth16Verifier  │
                    └─────────────┘     └──────────────────┘
```

**Packages:**

| Package | Description |
|---------|-------------|
| `packages/frontend` | Next.js 15 + Tailwind v4 + wagmi + RainbowKit |
| `packages/backend` | Express + WebSocket + SQLite + ZK proof generation |
| `packages/sdk` | Stealth address crypto (secp256k1 + viem) |
| `packages/contracts` | Solidity contracts + Circom circuits (Foundry) |

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 8
- **Foundry** (forge) — for contract compilation/deployment
- **Circom** 2.x — for circuit compilation (only needed if modifying circuits)

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/fspseva/The-Farside-Card.git
cd The-Farside-Card
pnpm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```
ALCHEMY_API_KEY=your_alchemy_key
DEPLOYER_PRIVATE_KEY=0x...
RELAYER_PRIVATE_KEY=0x...
```

- `ALCHEMY_API_KEY` — RPC access for Base Sepolia
- `DEPLOYER_PRIVATE_KEY` — only needed for contract deployment
- `RELAYER_PRIVATE_KEY` — backend uses this to submit withdraw transactions on-chain

### 3. Run the backend

```bash
cd packages/backend
node --import tsx src/index.ts
```

The backend starts on `http://localhost:3001`. It will:
- Initialize Poseidon hasher
- Sync the Merkle tree from on-chain events
- Open a WebSocket for real-time updates

### 4. Run the frontend

In a separate terminal:

```bash
cd packages/frontend
node node_modules/next/dist/bin/next dev --port 3000
```

Open **http://localhost:3000**.

> **Note:** The standard `pnpm dev` / `npx next dev` commands may fail if your project path contains special characters (like `:`). The `node node_modules/next/dist/bin/next` workaround avoids this.

## Usage

1. **Card App** (`/card`) — Complete the (pre-filled) KYC form to get a card, then top up by depositing USDC through the privacy pool.
2. **POS Terminal** (`/pos`) — Simulate merchant charges against the card balance. Open in a second browser tab to see real-time balance updates via WebSocket.

### Flow

1. User requests a stealth address for deposit
2. User sends USDC from **any wallet** to the stealth address
3. Backend detects the deposit, generates a Groth16 ZK proof
4. Backend submits `withdraw()` on-chain, crediting the pool without revealing the source
5. Card balance updates in real time

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| TestUSDC | `0xF99b0dF2cfe19a4B016205bc3664c57BE1F91bE1` |
| Groth16Verifier | `0xDB6576f9126414cA0c58E704d5fDFeC89BCbEfB9` |
| StealthPool10 | `0x95Ae9FE47Ad329846c4339814A1615d802560548` |
| StealthPool100 | `0x4D54039cfE96AA7902f0b9F56E5966CA419D2625` |
| ERC5564Announcer | `0x57c914b7c433755360a302Aa8Ff2c9cAcA15800A` |
| ERC6538Registry | `0xd1f9e9639a07B14992f8F4874A12495D8907bBf1` |

## Tech Stack

- **Contracts:** Solidity 0.8.24, Foundry
- **ZK Circuits:** Circom 2.x, snarkjs, Poseidon hash, Merkle tree depth 16
- **SDK:** @noble/secp256k1, viem
- **Frontend:** Next.js 15, React 19, Tailwind CSS v4, wagmi, RainbowKit
- **Backend:** Express, WebSocket (ws), better-sqlite3, viem

## License

MIT
