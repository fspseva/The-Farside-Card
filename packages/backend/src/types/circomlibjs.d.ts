declare module "circomlibjs" {
  interface PoseidonFunction {
    (inputs: (bigint | number | string)[]): Uint8Array;
    F: {
      toObject(el: Uint8Array): bigint;
    };
  }

  export function buildPoseidon(): Promise<PoseidonFunction>;
}
