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
  STEALTH_POOL_ABI,
  ERC20_ABI,
  DEFAULT_CHAIN_ID,
} from "./contracts.js";
import { parseEventLogs } from "viem";

/**
 * Process a deposit through the REAL on-chain privacy pool.
 *
 * Flow:
 * 1. Compute Poseidon commitment = Poseidon(nullifier, secret)
 * 2. Deployer must already have USDC (funded by user's on-chain deposit)
 * 3. Deployer approves + deposits commitment into StealthPool
 * 4. Parse Deposit event -> get leafIndex
 * 5. Build Merkle proof (pathElements + pathIndices)
 * 6. Generate Groth16 proof via snarkjs
 * 7. Relayer calls withdraw(proof, root, nullifierHash, recipient, relayer, fee)
 * 8. Credit card balance in Postgres, broadcast via WebSocket
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

  const chainId = deposit.chain_id || DEFAULT_CHAIN_ID;
  const addresses = getAddresses(chainId);
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
    // --- Step 1: Check deployer USDC balance ---
    broadcast({
      type: "deposit_status",
      cardId,
      status: "pooled",
      stealthAddress,
    });

    const deployerBalance = await publicClient.readContract({
      address: addresses.USDC,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [deployerAddress],
    });
    console.log(`[Relayer] Deployer USDC balance on chain ${chainId}: ${deployerBalance}`);
    if (deployerBalance < BigInt(denomination)) {
      throw new Error(`Deployer has insufficient USDC on chain ${chainId}: ${deployerBalance} < ${denomination}`);
    }

    // --- Step 2: Approve pool + deposit commitment ---
    await updateDepositStatus(deposit.commitment, "depositing");
    broadcast({
      type: "deposit_status",
      cardId,
      status: "proving",
      stealthAddress,
    });

    console.log(`[Relayer] Approving pool to spend USDC...`);
    const approveHash = await deployerClient.writeContract({
      address: addresses.USDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [poolAddress, BigInt(denomination)],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
    console.log(`[Relayer] Approve tx: ${approveHash}`);

    // Verify allowance before deposit
    const allowance = await publicClient.readContract({
      address: addresses.USDC,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [deployerAddress, poolAddress],
    });
    console.log(`[Relayer] Allowance after approve: ${allowance}`);
    if (allowance < BigInt(denomination)) {
      throw new Error(`Allowance insufficient after approve: ${allowance} < ${denomination}`);
    }

    console.log(`[Relayer] Depositing commitment into pool...`);
    const depositHash = await deployerClient.writeContract({
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

    // --- Step 3: Insert into local Merkle tree ---
    // Use chain-qualified key for the tree
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
      console.warn("[Relayer] WARNING: Root mismatch! Re-syncing tree...");
    }

    // --- Step 4: Build Merkle proof ---
    const { pathElements, pathIndices } = tree.getPath(insertedIndex);

    // --- Step 5: Generate ZK proof ---
    console.log("[Relayer] Generating ZK proof...");
    const recipient = relayerAddress;
    const fee = 0n;

    const { proof, publicSignals } = await generateWithdrawProof({
      root: localRoot,
      nullifierHash,
      recipient: BigInt(recipient),
      relayer: BigInt(relayerAddress),
      fee,
      nullifier,
      secret,
      pathElements,
      pathIndices,
    });

    console.log("[Relayer] ZK proof generated successfully");

    // --- Step 6: Relayer submits withdrawal ---
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

    // --- Step 7: Credit card balance ---
    const amount = deposit.denomination;
    await updateCardBalance(cardId, amount);

    await addTransaction(
      cardId,
      "deposit",
      amount,
      null,
      `Top-up ${amount / 1_000_000} USDC via privacy pool`,
      withdrawHash
    );

    const card = await getCard(cardId);

    broadcast({ type: "balance_update", cardId, balance: card.balance });

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
        created_at: new Date().toISOString(),
      },
    });

    console.log(`[Relayer] Deposit completed! New balance: ${card.balance}`);
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
