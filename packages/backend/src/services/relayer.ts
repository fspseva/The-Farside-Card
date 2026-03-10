import {
  createWalletClient,
  http,
  parseEventLogs,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bytesToHex } from "viem";
import {
  getCard,
  updateCardBalance,
  updateDepositStatus,
  updateDepositTxHashes,
  addTransaction,
  getPendingDeposits,
} from "../db/schema.js";
import { broadcast } from "../ws/broadcast.js";
import { poseidonHash1, poseidonHash2 } from "./poseidon.js";
import { getTree } from "./merkleTree.js";
import { generateWithdrawProof } from "./zkProof.js";
import {
  getPublicClient,
  getDeployerClient,
  getDeployerAddress,
  getPoolAddress,
  getAddresses,
  getChainConfig,
  STEALTH_POOL_ABI,
  ERC20_ABI,
  DEFAULT_CHAIN_ID,
} from "./contracts.js";
import { computeStealthPrivateKey } from "@stealth-card/sdk";

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Process a deposit through the REAL on-chain privacy pool.
 *
 * Correct flow (autocustodial & private):
 * 1. User already sent USDC to the stealth address (frontend)
 * 2. Derive stealth address private key from card keys + ephemeral pub key
 * 3. Deployer sends ETH to stealth address for gas
 * 4. Stealth address approves + deposits commitment into StealthPool
 * 5. Build Merkle proof, generate Groth16 ZK proof
 * 6. Deployer/relayer submits withdraw() — receives clean USDC
 * 7. Credit card balance in Postgres, broadcast via WebSocket
 */
export async function processDeposit(cardId: string, stealthAddress: string) {
  console.log(
    `[Relayer] Processing deposit for card ${cardId}, stealth: ${stealthAddress}`
  );

  const deposits = await getPendingDeposits();
  const deposit = deposits.find(
    (d: any) => d.card_id === cardId && d.stealth_address === stealthAddress
  );

  if (!deposit) {
    console.log("[Relayer] No pending deposit found");
    return;
  }

  const card = await getCard(cardId);
  if (!card) {
    console.log("[Relayer] Card not found");
    return;
  }

  const chainId = deposit.chain_id || DEFAULT_CHAIN_ID;
  const addresses = getAddresses(chainId);
  const chainConfig = getChainConfig(chainId);
  const publicClient = getPublicClient(chainId);
  const deployerClient = getDeployerClient(chainId);
  const deployerAddress = getDeployerAddress();
  const relayerAddress = deployerAddress;

  const denomination = deposit.denomination;
  const poolAddress = getPoolAddress(denomination, chainId);
  const nullifier = BigInt(deposit.nullifier);
  const secret = BigInt(deposit.secret);
  const commitment = poseidonHash2(nullifier, secret);
  const nullifierHash = poseidonHash1(nullifier);

  console.log(`[Relayer] Chain: ${chainId}`);
  console.log(`[Relayer] Commitment: ${commitment}`);
  console.log(`[Relayer] NullifierHash: ${nullifierHash}`);
  console.log(`[Relayer] Pool: ${poolAddress}`);
  console.log(`[Relayer] USDC: ${addresses.USDC}`);
  console.log(`[Relayer] Denomination: ${denomination} (${denomination / 1_000_000} USDC)`);

  try {
    // --- Step 1: Derive stealth address private key ---
    const stealthPrivKey = computeStealthPrivateKey({
      spendingKey: hexToBytes(card.spending_priv_key),
      ephemeralPubKey: hexToBytes(deposit.ephemeral_pub_key),
      viewingKey: hexToBytes(card.viewing_priv_key),
    });

    const stealthAccount = privateKeyToAccount(bytesToHex(stealthPrivKey) as `0x${string}`);
    console.log(`[Relayer] Derived stealth address: ${stealthAccount.address}`);
    console.log(`[Relayer] Expected stealth address: ${stealthAddress}`);

    if (stealthAccount.address.toLowerCase() !== stealthAddress.toLowerCase()) {
      throw new Error(`Stealth key derivation mismatch: got ${stealthAccount.address}, expected ${stealthAddress}`);
    }

    // --- Step 2: Wait for USDC to arrive at stealth address ---
    broadcast({
      type: "deposit_status",
      cardId,
      status: "pooled",
      stealthAddress,
    });

    let stealthBalance = 0n;
    const MAX_RETRIES = 15;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      stealthBalance = (await publicClient.readContract({
        address: addresses.USDC,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [stealthAddress as `0x${string}`],
      })) as bigint;
      console.log(`[Relayer] Stealth address USDC balance (attempt ${attempt}/${MAX_RETRIES}): ${stealthBalance}`);

      if (stealthBalance >= BigInt(denomination)) break;

      if (attempt === MAX_RETRIES) {
        throw new Error(`USDC not arrived at stealth address after ${MAX_RETRIES} attempts: ${stealthBalance} < ${denomination}`);
      }
      await new Promise((r) => setTimeout(r, 3000)); // wait 3s between checks
    }

    // --- Step 3: Fund stealth address with ETH for gas ---
    await updateDepositStatus(deposit.commitment, "depositing");
    broadcast({
      type: "deposit_status",
      cardId,
      status: "proving",
      stealthAddress,
    });

    console.log(`[Relayer] Funding stealth address with ETH for gas...`);
    const fundHash = await deployerClient.sendTransaction({
      to: stealthAddress as `0x${string}`,
      value: parseEther("0.005"),
    });
    await publicClient.waitForTransactionReceipt({ hash: fundHash });
    console.log(`[Relayer] Gas funding tx: ${fundHash}`);

    // --- Step 4: Stealth address approves + deposits into pool ---
    const alchemyKey = process.env.ALCHEMY_API_KEY;
    const rpcUrl = alchemyKey
      ? `https://${chainConfig.rpcPath}.g.alchemy.com/v2/${alchemyKey}`
      : chainConfig.fallback;

    const stealthClient = createWalletClient({
      account: stealthAccount,
      chain: chainConfig.chain,
      transport: http(rpcUrl),
    });

    console.log(`[Relayer] Stealth address approving pool...`);
    const approveHash = await stealthClient.writeContract({
      address: addresses.USDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [poolAddress, BigInt(denomination)],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log(`[Relayer] Approve tx: ${approveHash}`);

    console.log(`[Relayer] Stealth address depositing commitment into pool...`);
    const depositHash = await stealthClient.writeContract({
      address: poolAddress,
      abi: STEALTH_POOL_ABI,
      functionName: "deposit",
      args: [commitment],
    });
    const depositReceipt = await publicClient.waitForTransactionReceipt({
      hash: depositHash,
    });
    console.log(`[Relayer] Deposit tx: ${depositHash}`);

    // Parse Deposit event to get leafIndex
    const depositLogs = parseEventLogs({
      abi: STEALTH_POOL_ABI,
      logs: depositReceipt.logs,
      eventName: "Deposit",
    });

    if (depositLogs.length === 0) {
      throw new Error("No Deposit event found in receipt");
    }

    const leafIndex = Number(depositLogs[0].args.leafIndex);
    console.log(`[Relayer] Leaf index: ${leafIndex}`);

    await updateDepositStatus(deposit.commitment, "deposited", leafIndex);
    await updateDepositTxHashes(deposit.commitment, depositHash);

    // --- Step 5: Insert into local Merkle tree ---
    const treeKey = `${chainId}:${poolAddress}`;
    const tree = getTree(treeKey);
    const insertedIndex = tree.insert(commitment);
    console.log(`[Relayer] Inserted into local tree at index ${insertedIndex}`);

    const localRoot = tree.getRoot();
    const onChainRoot = await publicClient.readContract({
      address: poolAddress,
      abi: STEALTH_POOL_ABI,
      functionName: "getLastRoot",
    });
    console.log(`[Relayer] Local root:    ${localRoot}`);
    console.log(`[Relayer] On-chain root: ${onChainRoot}`);

    if (localRoot !== onChainRoot) {
      console.warn("[Relayer] WARNING: Root mismatch!");
    }

    // --- Step 6: Build Merkle proof + generate ZK proof ---
    const { pathElements, pathIndices } = tree.getPath(insertedIndex);

    console.log("[Relayer] Generating ZK proof...");
    const fee = 0n;

    const { proof, publicSignals } = await generateWithdrawProof({
      root: localRoot,
      nullifierHash,
      recipient: BigInt(relayerAddress),
      relayer: BigInt(relayerAddress),
      fee,
      nullifier,
      secret,
      pathElements,
      pathIndices,
    });

    console.log("[Relayer] ZK proof generated successfully");

    // --- Step 7: Deployer submits withdrawal (receives clean USDC) ---
    console.log("[Relayer] Submitting withdrawal on-chain...");
    const withdrawHash = await deployerClient.writeContract({
      address: poolAddress,
      abi: STEALTH_POOL_ABI,
      functionName: "withdraw",
      args: [
        proof as any,
        localRoot,
        nullifierHash,
        relayerAddress,
        relayerAddress,
        fee,
      ],
    });
    const withdrawReceipt = await publicClient.waitForTransactionReceipt({
      hash: withdrawHash,
    });
    console.log(`[Relayer] Withdraw tx: ${withdrawHash}`);
    console.log(`[Relayer] Withdraw status: ${withdrawReceipt.status}`);

    await updateDepositTxHashes(deposit.commitment, undefined, withdrawHash);
    await updateDepositStatus(deposit.commitment, "withdrawn");

    // --- Step 8: Credit card balance ---
    const amount = deposit.denomination;
    await updateCardBalance(cardId, amount);

    await addTransaction(
      cardId,
      "deposit",
      amount,
      null,
      `Top-up ${amount / 1_000_000} USDC via privacy pool`,
      withdrawHash,
      chainId
    );

    const updatedCard = await getCard(cardId);

    broadcast({ type: "balance_update", cardId, balance: updatedCard.balance });

    broadcast({
      type: "deposit_status",
      cardId,
      status: "completed",
      stealthAddress,
    });

    broadcast({
      type: "transaction",
      cardId,
      tx: {
        type: "deposit",
        amount,
        merchant: null,
        description: `Top-up ${amount / 1_000_000} USDC via privacy pool`,
        tx_hash: withdrawHash,
        chain_id: chainId,
        created_at: new Date().toISOString(),
      },
    });

    console.log(`[Relayer] Deposit completed! New balance: ${updatedCard.balance}`);
    console.log(`[Relayer] Deposit tx: ${depositHash}`);
    console.log(`[Relayer] Withdraw tx: ${withdrawHash}`);
  } catch (error) {
    console.error("[Relayer] Error processing deposit:", error);
    await updateDepositStatus(deposit.commitment, "failed");
    broadcast({
      type: "deposit_status",
      cardId,
      status: "failed",
      stealthAddress,
    });
  }
}
