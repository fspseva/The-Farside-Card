import * as secp from "@noble/secp256k1";
import { bytesToHex, keccak256 } from "viem";
import type { StealthKeys, StealthMetaAddress } from "./types.js";

/**
 * Generate a new pair of stealth keys (spending + viewing).
 */
export function generateStealthKeys(): StealthKeys {
  const spendingKey = secp.utils.randomPrivateKey();
  const viewingKey = secp.utils.randomPrivateKey();
  const spendingPubKey = secp.getPublicKey(spendingKey, true);
  const viewingPubKey = secp.getPublicKey(viewingKey, true);

  return { spendingKey, viewingKey, spendingPubKey, viewingPubKey };
}

/**
 * Extract the StealthMetaAddress (public keys only) from full StealthKeys.
 */
export function toStealthMetaAddress(keys: StealthKeys): StealthMetaAddress {
  return {
    spendingPubKey: keys.spendingPubKey,
    viewingPubKey: keys.viewingPubKey,
  };
}

/**
 * Encode a stealth meta-address to the st:eth:0x<spend><view> URI format.
 */
export function encodeStealthMetaAddress(meta: StealthMetaAddress): string {
  const spendHex = bytesToHex(meta.spendingPubKey).slice(2);
  const viewHex = bytesToHex(meta.viewingPubKey).slice(2);
  return `st:eth:0x${spendHex}${viewHex}`;
}

/**
 * Decode a st:eth:0x<spend><view> URI into a StealthMetaAddress.
 */
export function decodeStealthMetaAddress(uri: string): StealthMetaAddress {
  if (!uri.startsWith("st:eth:0x")) {
    throw new Error("Invalid stealth meta-address URI");
  }
  const hex = uri.slice("st:eth:0x".length);
  if (hex.length !== 132) {
    throw new Error(
      `Invalid stealth meta-address length: expected 132 hex chars, got ${hex.length}`
    );
  }
  const spendingPubKey = hexToBytes(hex.slice(0, 66));
  const viewingPubKey = hexToBytes(hex.slice(66));
  return { spendingPubKey, viewingPubKey };
}

/**
 * Compute Ethereum address from a public key.
 */
export function publicKeyToAddress(pubKey: Uint8Array): `0x${string}` {
  const uncompressed = secp.ProjectivePoint.fromHex(pubKey).toRawBytes(false);
  const hash = keccak256(bytesToHex(uncompressed.slice(1)));
  return `0x${hash.slice(26)}` as `0x${string}`;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
