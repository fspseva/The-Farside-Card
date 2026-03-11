import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false>;

export async function initDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");
  sql = neon(dbUrl);

  await sql`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      spending_pub_key TEXT,
      viewing_priv_key TEXT,
      spending_priv_key TEXT,
      stealth_meta_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      card_id TEXT REFERENCES cards(id),
      type TEXT,
      amount INTEGER,
      merchant TEXT,
      description TEXT,
      tx_hash TEXT,
      chain_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS deposits (
      id SERIAL PRIMARY KEY,
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Add chain_id column to transactions if it doesn't exist
  await sql`
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS chain_id INTEGER
  `;

  console.log("[DB] Neon Postgres tables initialized");
}

export async function createCard(
  id: string,
  spendingPubKey: string,
  viewingPrivKey: string,
  spendingPrivKey: string,
  stealthMetaAddress: string
) {
  await sql`
    INSERT INTO cards (id, spending_pub_key, viewing_priv_key, spending_priv_key, stealth_meta_address)
    VALUES (${id}, ${spendingPubKey}, ${viewingPrivKey}, ${spendingPrivKey}, ${stealthMetaAddress})
  `;
}

export async function getCard(id: string) {
  const rows = await sql`SELECT * FROM cards WHERE id = ${id}`;
  return rows[0] || null;
}

export async function updateCardBalance(id: string, amount: number) {
  await sql`UPDATE cards SET balance = balance + ${amount} WHERE id = ${id}`;
}

export async function getTransactions(cardId: string) {
  return await sql`
    SELECT * FROM transactions WHERE card_id = ${cardId} ORDER BY created_at DESC
  `;
}

export async function addTransaction(
  cardId: string,
  type: string,
  amount: number,
  merchant: string | null,
  description: string,
  txHash: string | null,
  chainId?: number | null
) {
  await sql`
    INSERT INTO transactions (card_id, type, amount, merchant, description, tx_hash, chain_id)
    VALUES (${cardId}, ${type}, ${amount}, ${merchant}, ${description}, ${txHash}, ${chainId ?? null})
  `;
}

export async function createDeposit(
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
  await sql`
    INSERT INTO deposits (card_id, commitment, nullifier, secret, stealth_address, ephemeral_pub_key, view_tag, chain_id, denomination)
    VALUES (${cardId}, ${commitment}, ${nullifier}, ${secret}, ${stealthAddress}, ${ephemeralPubKey}, ${viewTag}, ${chainId}, ${denomination})
  `;
}

export async function getDeposit(commitment: string) {
  const rows = await sql`SELECT * FROM deposits WHERE commitment = ${commitment}`;
  return rows[0] || null;
}

export async function getDepositsByCard(cardId: string) {
  return await sql`
    SELECT * FROM deposits WHERE card_id = ${cardId} ORDER BY created_at DESC
  `;
}

export async function updateDepositStatus(
  commitment: string,
  status: string,
  leafIndex?: number
) {
  if (leafIndex !== undefined) {
    await sql`
      UPDATE deposits SET status = ${status}, leaf_index = ${leafIndex} WHERE commitment = ${commitment}
    `;
  } else {
    await sql`
      UPDATE deposits SET status = ${status} WHERE commitment = ${commitment}
    `;
  }
}

export async function getPendingDeposits() {
  return await sql`SELECT * FROM deposits WHERE status = 'pending'`;
}

export async function getDepositedCommitments() {
  return await sql`
    SELECT commitment, leaf_index, chain_id, denomination
    FROM deposits
    WHERE leaf_index IS NOT NULL
    ORDER BY leaf_index ASC
  `;
}

export async function updateDepositTxHashes(
  commitment: string,
  depositTxHash?: string,
  withdrawTxHash?: string
) {
  if (depositTxHash) {
    await sql`UPDATE deposits SET deposit_tx_hash = ${depositTxHash} WHERE commitment = ${commitment}`;
  }
  if (withdrawTxHash) {
    await sql`UPDATE deposits SET withdraw_tx_hash = ${withdrawTxHash} WHERE commitment = ${commitment}`;
  }
}
