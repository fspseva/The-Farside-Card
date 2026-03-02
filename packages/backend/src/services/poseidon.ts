import { buildPoseidon } from "circomlibjs";

let poseidon: any = null;
let F: any = null;

export async function initPoseidon(): Promise<void> {
  poseidon = await buildPoseidon();
  F = poseidon.F;
  console.log("[Poseidon] Initialized");
}

export function poseidonHash2(left: bigint, right: bigint): bigint {
  if (!poseidon) throw new Error("Poseidon not initialized — call initPoseidon() first");
  return F.toObject(poseidon([left, right]));
}

export function poseidonHash1(input: bigint): bigint {
  if (!poseidon) throw new Error("Poseidon not initialized — call initPoseidon() first");
  return F.toObject(poseidon([input]));
}
