# Stealth Crypto Card

Privacy-preserving crypto card powered by stealth addresses (ERC-5564 + ERC-6538) and a ZK privacy pool (Groth16).

**The protocol never sees which wallet funded the card.** Users deposit into a ZK privacy pool via stealth addresses, and withdraw with a zero-knowledge proof that breaks the on-chain link between depositor and cardholder.

This repo is part of [Haven's](https://haven.hn) exploration of privacy-preserving crypto cards.

---

## Background: ERC-5564 & ERC-6538

### What These Standards Do

**ERC-5564** defines a protocol for stealth addresses — one-time, disposable addresses generated for each transaction. When someone sends you funds, the sender generates a unique address that only you (the recipient) can detect and spend from. Nobody watching the chain can link that stealth address back to your public identity.

**ERC-6538** is the companion standard — it creates an on-chain registry where users publish their "stealth meta-address" (a pair of public keys: a spending key and a viewing key). The sender looks up your meta-address, uses it to derive a one-time stealth address, and sends funds there. The viewing key is the clever part — it lets you (or a trusted third party) scan the chain and find payments addressed to you, without revealing that link publicly.

### How This Differs From Mixers

A mixer pools funds from multiple users and redistributes them, breaking the transaction graph. Stealth addresses don't pool anything. Funds move directly from sender to recipient — there's a 1-to-1 relationship, no commingling. The privacy comes from address unlinkability, not from obscuring the fund flow. This is a fundamentally different architecture from what FinCEN's CVC mixing rule targets. There's no "splitting, batching, or rotating" — there's just a fresh receiving address each time.

### The Compliance-Friendly Design

The dual-key structure is what makes stealth addresses potentially regulation-compatible. The viewing key can be selectively shared with regulators, auditors, or compliance officers — giving them the ability to see all incoming transactions to a user without that information being public on-chain.

### Umbra — The Live Implementation

The most mature implementation of these standards is Umbra (now on both Ethereum and Solana). Their compliance framework includes three layers of defense:

1. **Proactive OFAC screening** directly at the smart contract level through oracle integration — checking wallet addresses against sanctions lists before transactions execute.
2. **Voluntary disclosure** through a Master Viewing Key system — users can derive time-scoped, constrained viewing keys for auditors (meaning you can share access to just one month of transactions, not your entire history).
3. **Retroactive decryption** capability built into the protocol itself as a last resort.

### Vitalik's Kohaku Framework

In late 2025, Vitalik Buterin unveiled Kohaku, a privacy toolkit that builds directly on ERC-5564 stealth addresses combined with Privacy Pools. The Privacy Pools concept (co-authored with Ameen Soleimani and Jacob Illum) is the regulatory bridge: users generate ZK proofs showing their funds are not linked to illicit sources, without revealing full transaction history. The key design principle is "private by default, verifiable on demand."

Kohaku's rollout is phased: browser extension in 2025, L2 network expansion next, a dedicated privacy browser with AI-based risk warnings by 2026, and eventually full ZK-based account abstraction.

### How This Maps to Haven's Regulatory Framework

ERC-5564/6538 slot into Haven's privacy-preserving transaction flow:

- **Step 1 (KYC):** The user registers their stealth meta-address on the ERC-6538 registry, linked to their verified KYC identity in Haven's internal system.
- **Step 2 (OFAC):** Haven screens the recipient's meta-address before generating the stealth address — similar to Umbra's oracle-based approach.
- **Step 5 (Travel Rule):** Haven shares the viewing key (or a constrained derivative) with the counterparty VASP, satisfying the data-sharing requirement without exposing the user's full address history.
- **Step 7 (SAR/CTR):** Haven retains the viewing key internally, allowing it to reconstruct transaction history for FinCEN filings when required.

---

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

## Deployed Contracts

All deployments use Circle's official testnet USDC.

### Base Sepolia (84532)

| Contract | Address |
|----------|---------|
| USDC (Circle) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Groth16Verifier | `0xDB6576f9126414cA0c58E704d5fDFeC89BCbEfB9` |
| StealthPool10 | `0x9CD59E5eBC6c9C5188F115Cb7697293E77734C1d` |
| StealthPool100 | `0x9284556402A696BaEb27e160d210eF73C1057969` |
| ERC5564Announcer | `0x57c914b7c433755360a302Aa8Ff2c9cAcA15800A` |
| ERC6538Registry | `0xd1f9e9639a07B14992f8F4874A12495D8907bBf1` |

### Eth Sepolia (11155111)

| Contract | Address |
|----------|---------|
| USDC (Circle) | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| Groth16Verifier | `0x6F466b9ECc083E585C41a584b25fBA30885C64B8` |
| StealthPool10 | `0x45f2B9fA4F39ad69Ee562D43b74F4CaEc28c7c62` |
| StealthPool100 | `0xF8373Bdda4C2b07659F31f9fdAC446198E0B4e33` |
| ERC5564Announcer | `0xbE02fF1b909DC6a560533162FA7FC888bd240EdC` |
| ERC6538Registry | `0x8f4FBD57C898CC542F497B4a1e0C00012e4948B2` |

### Arbitrum Sepolia (421614)

| Contract | Address |
|----------|---------|
| USDC (Circle) | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
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
