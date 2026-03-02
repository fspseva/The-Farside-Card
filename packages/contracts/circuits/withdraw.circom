pragma circom 2.0.0;

include "./merkleTree.circom";
include "./poseidonHasher.circom";

// Main withdrawal circuit
// Proves: I know (nullifier, secret) such that:
//   1. Poseidon(nullifier, secret) is a leaf in the Merkle tree with the given root
//   2. nullifierHash == Poseidon(nullifier)
// Public inputs are used by the contract to verify the proof
template Withdraw(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input recipient;       // not used in constraints, prevents front-running
    signal input relayer;         // not used in constraints, prevents front-running
    signal input fee;             // not used in constraints, prevents front-running

    // Private inputs
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Hash the nullifier and secret to get commitment
    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;

    // Verify nullifier hash matches
    hasher.nullifierHash === nullifierHash;

    // Verify Merkle tree inclusion
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Add hidden signals to prevent tampering with recipient, relayer, fee
    // Square to prevent optimizer from removing them
    signal recipientSquare;
    signal relayerSquare;
    signal feeSquare;
    recipientSquare <== recipient * recipient;
    relayerSquare <== relayer * relayer;
    feeSquare <== fee * fee;
}

component main {public [root, nullifierHash, recipient, relayer, fee]} = Withdraw(16);
