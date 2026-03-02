// Compute the 16 zero values for an empty incremental Merkle tree using Poseidon
// Usage: npx tsx script/computeZeros.ts

import { buildPoseidon } from "circomlibjs";

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const DEPTH = 16;
  const zeros: string[] = [];

  // Zero leaf = 0
  let current = F.zero;
  zeros.push(F.toString(current));

  for (let i = 1; i <= DEPTH; i++) {
    current = poseidon([current, current]);
    zeros.push(F.toString(current));
  }

  console.log("// Zero values for empty Merkle tree (Poseidon, depth 16)");
  console.log("// zeros[0] = hash of empty leaf (0)");
  console.log("// zeros[i] = Poseidon(zeros[i-1], zeros[i-1])");
  console.log("");

  for (let i = 0; i <= DEPTH; i++) {
    console.log(`uint256 constant Z_${i} = ${zeros[i]};`);
  }

  console.log("");
  console.log("function zeros(uint256 i) internal pure returns (uint256) {");
  for (let i = 0; i <= DEPTH; i++) {
    console.log(`    if (i == ${i}) return Z_${i};`);
  }
  console.log('    revert("Index out of bounds");');
  console.log("}");
}

main().catch(console.error);
