import path from "path";
import { fileURLToPath } from "url";
import { groth16 } from "snarkjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths to circuit artifacts
const WASM_PATH = path.join(
  __dirname,
  "../../../contracts/build/circuits/withdraw_js/withdraw.wasm"
);
const ZKEY_PATH = path.join(
  __dirname,
  "../../../contracts/build/circuits/withdraw_final.zkey"
);

export interface WithdrawProofInput {
  root: bigint;
  nullifierHash: bigint;
  recipient: bigint;
  relayer: bigint;
  fee: bigint;
  nullifier: bigint;
  secret: bigint;
  pathElements: bigint[];
  pathIndices: number[];
}

export interface WithdrawProofResult {
  proof: bigint[];
  publicSignals: bigint[];
}

/**
 * Generate a Groth16 withdraw proof.
 * Returns proof as 8 bigints in Solidity-ready format and 5 public signals.
 */
export async function generateWithdrawProof(
  input: WithdrawProofInput
): Promise<WithdrawProofResult> {
  console.log("[ZKProof] Generating Groth16 proof...");

  const circuitInput = {
    root: input.root.toString(),
    nullifierHash: input.nullifierHash.toString(),
    recipient: input.recipient.toString(),
    relayer: input.relayer.toString(),
    fee: input.fee.toString(),
    nullifier: input.nullifier.toString(),
    secret: input.secret.toString(),
    pathElements: input.pathElements.map((e) => e.toString()),
    pathIndices: input.pathIndices,
  };

  const { proof, publicSignals } = await groth16.fullProve(
    circuitInput,
    WASM_PATH,
    ZKEY_PATH
  );

  // Convert snarkjs proof to Solidity format
  // snarkjs: { pi_a: [x,y,1], pi_b: [[x1,x2],[y1,y2],[1,0]], pi_c: [x,y,1] }
  // Solidity: [a0, a1, b[0][1], b[0][0], b[1][1], b[1][0], c0, c1]
  // Note: B coordinates are transposed for the pairing check
  const solidityProof: bigint[] = [
    BigInt(proof.pi_a[0]),
    BigInt(proof.pi_a[1]),
    BigInt(proof.pi_b[0][1]), // transposed
    BigInt(proof.pi_b[0][0]), // transposed
    BigInt(proof.pi_b[1][1]), // transposed
    BigInt(proof.pi_b[1][0]), // transposed
    BigInt(proof.pi_c[0]),
    BigInt(proof.pi_c[1]),
  ];

  const solidityPublicSignals: bigint[] = publicSignals.map((s: string) =>
    BigInt(s)
  );

  console.log("[ZKProof] Proof generated successfully");

  return {
    proof: solidityProof,
    publicSignals: solidityPublicSignals,
  };
}
