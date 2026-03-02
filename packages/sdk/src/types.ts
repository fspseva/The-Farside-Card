export interface StealthKeys {
  spendingKey: Uint8Array; // 32 bytes private key
  viewingKey: Uint8Array; // 32 bytes private key
  spendingPubKey: Uint8Array; // 33 bytes compressed public key
  viewingPubKey: Uint8Array; // 33 bytes compressed public key
}

export interface StealthMetaAddress {
  spendingPubKey: Uint8Array; // 33 bytes compressed
  viewingPubKey: Uint8Array; // 33 bytes compressed
}

export interface StealthAddressResult {
  stealthAddress: `0x${string}`;
  ephemeralPubKey: Uint8Array; // 33 bytes compressed
  viewTag: number; // 1 byte
}

export interface StealthCheckParams {
  ephemeralPubKey: Uint8Array;
  viewingKey: Uint8Array;
  spendingPubKey: Uint8Array;
  viewTag: number;
}

export interface StealthPrivateKeyParams {
  spendingKey: Uint8Array;
  ephemeralPubKey: Uint8Array;
  viewingKey: Uint8Array;
}
