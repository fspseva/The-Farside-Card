import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/stealth-card.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0,
    spending_pub_key TEXT,
    viewing_priv_key TEXT,
    spending_priv_key TEXT,
    stealth_meta_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT REFERENCES cards(id),
    type TEXT,
    amount INTEGER,
    merchant TEXT,
    description TEXT,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT REFERENCES cards(id),
    commitment TEXT,
    nullifier TEXT,
    secret TEXT,
    leaf_index INTEGER,
    stealth_address TEXT,
    ephemeral_pub_key TEXT,
    view_tag INTEGER,
    status TEXT DEFAULT 'pending',
    chain_id INTEGER,
    denomination INTEGER,
    deposit_tx_hash TEXT,
    withdraw_tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;

export function createCard(
  id: string,
  spendingPubKey: string,
  viewingPrivKey: string,
  spendingPrivKey: string,
  stealthMetaAddress: string
) {
  return db
    .prepare(
      "INSERT INTO cards (id, spending_pub_key, viewing_priv_key, spending_priv_key, stealth_meta_address) VALUES (?, ?, ?, ?, ?)"
    )
    .run(id, spendingPubKey, viewingPrivKey, spendingPrivKey, stealthMetaAddress);
}

export function getCard(id: string) {
  return db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as any;
}

export function updateCardBalance(id: string, amount: number) {
  return db
    .prepare("UPDATE cards SET balance = balance + ? WHERE id = ?")
    .run(amount, id);
}

export function getTransactions(cardId: string) {
  return db
    .prepare(
      "SELECT * FROM transactions WHERE card_id = ? ORDER BY created_at DESC"
    )
    .all(cardId) as any[];
}

export function addTransaction(
  cardId: string,
  type: string,
  amount: number,
  merchant: string | null,
  description: string,
  txHash: string | null
) {
  return db
    .prepare(
      "INSERT INTO transactions (card_id, type, amount, merchant, description, tx_hash) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(cardId, type, amount, merchant, description, txHash);
}

export function createDeposit(
  cardId: string,
  commitment: string,
  nullifier: string,
  secret: string,
  stealthAddress: string,
  ephemeralPubKey: string,
  viewTag: number,
  chainId: number,
  denomination: number
) {
  return db
    .prepare(
      "INSERT INTO deposits (card_id, commitment, nullifier, secret, stealth_address, ephemeral_pub_key, view_tag, chain_id, denomination) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      cardId,
      commitment,
      nullifier,
      secret,
      stealthAddress,
      ephemeralPubKey,
      viewTag,
      chainId,
      denomination
    );
}

export function getDeposit(commitment: string) {
  return db
    .prepare("SELECT * FROM deposits WHERE commitment = ?")
    .get(commitment) as any;
}

export function getDepositsByCard(cardId: string) {
  return db
    .prepare("SELECT * FROM deposits WHERE card_id = ? ORDER BY created_at DESC")
    .all(cardId) as any[];
}

export function updateDepositStatus(
  commitment: string,
  status: string,
  leafIndex?: number
) {
  if (leafIndex !== undefined) {
    return db
      .prepare("UPDATE deposits SET status = ?, leaf_index = ? WHERE commitment = ?")
      .run(status, leafIndex, commitment);
  }
  return db
    .prepare("UPDATE deposits SET status = ? WHERE commitment = ?")
    .run(status, commitment);
}

export function getPendingDeposits() {
  return db
    .prepare("SELECT * FROM deposits WHERE status = 'pending'")
    .all() as any[];
}

export function updateDepositTxHashes(
  commitment: string,
  depositTxHash?: string,
  withdrawTxHash?: string
) {
  if (depositTxHash) {
    db.prepare("UPDATE deposits SET deposit_tx_hash = ? WHERE commitment = ?").run(
      depositTxHash,
      commitment
    );
  }
  if (withdrawTxHash) {
    db.prepare("UPDATE deposits SET withdraw_tx_hash = ? WHERE commitment = ?").run(
      withdrawTxHash,
      commitment
    );
  }
}
