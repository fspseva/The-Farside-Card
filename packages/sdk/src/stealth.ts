import * as secp from "@noble/secp256k1";
import { bytesToHex, keccak256 } from "viem";
import { publicKeyToAddress } from "./keys.js";
import type {
  StealthMetaAddress,
  StealthAddressResult,
  StealthCheckParams,
  StealthPrivateKeyParams,
} from "./types.js";

const CURVE_ORDER = secp.CURVE.n;

/**
 * Generate a stealth address from a stealth meta-address (ERC-5564 Scheme 1).
 *
 * Flow:
 * 1. Generate ephemeral keypair (r, R = r*G)
 * 2. ECDH shared secret: S = r * P_view
 * 3. Hash: h = keccak256(S_compressed)
 * 4. View tag = h[0]
 * 5. Stealth pubkey: P_stealth = P_spend + h*G
 * 6. Stealth address = publicKeyToAddress(P_stealth)
 */
export function generateStealthAddress(
  meta: StealthMetaAddress
): StealthAddressResult {
  // 1. Ephemeral keypair
  const ephemeralKey = secp.utils.randomPrivateKey();
  const ephemeralPubKey = secp.getPublicKey(ephemeralKey, true);

  // 2. ECDH: S = r * P_view
  const sharedSecret = secp.getSharedSecret(ephemeralKey, meta.viewingPubKey);

  // 3. h = keccak256(S_compressed)
  const h = keccak256(bytesToHex(sharedSecret));

  // 4. View tag = first byte of hash
  const viewTag = parseInt(h.slice(2, 4), 16);

  // 5. h as scalar (mod n)
  const hScalar = BigInt(h) % CURVE_ORDER;

  // P_stealth = P_spend + h*G
  const spendPoint = secp.ProjectivePoint.fromHex(meta.spendingPubKey);
  const hPoint = secp.ProjectivePoint.BASE.multiply(hScalar);
  const stealthPoint = spendPoint.add(hPoint);
  const stealthPubKey = stealthPoint.toRawBytes(true);

  // 6. Address
  const stealthAddress = publicKeyToAddress(stealthPubKey);

  return { stealthAddress, ephemeralPubKey, viewTag };
}

/**
 * Check if a stealth address belongs to the recipient (used for scanning).
 * Uses view tag as fast-path rejection (6x speedup).
 *
 * Returns the stealth address if it matches, null otherwise.
 */
export function checkStealthAddress(
  params: StealthCheckParams
): `0x${string}` | null {
  const { ephemeralPubKey, viewingKey, spendingPubKey, viewTag } = params;

  // ECDH: S = v * R (where v = viewing key, R = ephemeral pub key)
  const sharedSecret = secp.getSharedSecret(viewingKey, ephemeralPubKey);

  // h = keccak256(S_compressed)
  const h = keccak256(bytesToHex(sharedSecret));

  // Fast-path: check view tag
  const computedViewTag = parseInt(h.slice(2, 4), 16);
  if (computedViewTag !== viewTag) {
    return null;
  }

  // Full verification: compute stealth address
  const hScalar = BigInt(h) % CURVE_ORDER;
  const spendPoint = secp.ProjectivePoint.fromHex(spendingPubKey);
  const hPoint = secp.ProjectivePoint.BASE.multiply(hScalar);
  const stealthPoint = spendPoint.add(hPoint);
  const stealthPubKey = stealthPoint.toRawBytes(true);

  return publicKeyToAddress(stealthPubKey);
}

/**
 * Compute the private key for a stealth address.
 * p_stealth = (p_spend + h) mod n
 */
export function computeStealthPrivateKey(
  params: StealthPrivateKeyParams
): Uint8Array {
  const { spendingKey, ephemeralPubKey, viewingKey } = params;

  // ECDH: S = v * R
  const sharedSecret = secp.getSharedSecret(viewingKey, ephemeralPubKey);

  // h = keccak256(S_compressed)
  const h = keccak256(bytesToHex(sharedSecret));
  const hScalar = BigInt(h) % CURVE_ORDER;

  // p_stealth = (p_spend + h) mod n
  const spendScalar = bytesToBigInt(spendingKey);
  const stealthScalar = (spendScalar + hScalar) % CURVE_ORDER;

  return bigIntToBytes(stealthScalar, 32);
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let hex = "0x";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return BigInt(hex);
}

function bigIntToBytes(n: bigint, length: number): Uint8Array {
  const hex = n.toString(16).padStart(length * 2, "0");
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
