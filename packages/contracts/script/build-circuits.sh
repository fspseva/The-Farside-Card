#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(dirname "$SCRIPT_DIR")"
CIRCUITS_DIR="$CONTRACTS_DIR/circuits"
BUILD_DIR="$CONTRACTS_DIR/build/circuits"
PTAU_FILE="$BUILD_DIR/powersOfTau28_hez_final_16.ptau"

export PATH="$HOME/bin:$PATH"

echo "=== Building ZK Circuits ==="

# Create build directory
mkdir -p "$BUILD_DIR"

# Step 1: Install circomlib if not present
if [ ! -d "$CONTRACTS_DIR/node_modules/circomlib" ]; then
    echo "Installing circomlib..."
    cd "$CONTRACTS_DIR" && pnpm install
fi

# Step 2: Compile the circuit
echo "Compiling withdraw.circom..."
circom "$CIRCUITS_DIR/withdraw.circom" \
    --r1cs \
    --wasm \
    --sym \
    -o "$BUILD_DIR" \
    -l "$CONTRACTS_DIR/node_modules"

echo "Circuit compiled. Constraints: $(snarkjs r1cs info "$BUILD_DIR/withdraw.r1cs" 2>&1 | grep 'Constraints' || echo 'check manually')"

# Step 3: Download ptau file if not present
if [ ! -f "$PTAU_FILE" ]; then
    echo "Downloading Powers of Tau file (depth 16)..."
    curl -L -o "$PTAU_FILE" \
        "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_16.ptau"
fi

# Step 4: Groth16 setup
echo "Running Groth16 setup..."
snarkjs groth16 setup \
    "$BUILD_DIR/withdraw.r1cs" \
    "$PTAU_FILE" \
    "$BUILD_DIR/withdraw_0000.zkey"

# Step 5: Contribute to ceremony (deterministic for reproducibility)
echo "Contributing to ceremony..."
snarkjs zkey contribute \
    "$BUILD_DIR/withdraw_0000.zkey" \
    "$BUILD_DIR/withdraw_final.zkey" \
    --name="stealth-card-demo" \
    -e="stealth-card-random-entropy-for-demo"

# Step 6: Export verification key
echo "Exporting verification key..."
snarkjs zkey export verificationkey \
    "$BUILD_DIR/withdraw_final.zkey" \
    "$BUILD_DIR/verification_key.json"

# Step 7: Export Solidity verifier
echo "Exporting Solidity verifier..."
snarkjs zkey export solidityverifier \
    "$BUILD_DIR/withdraw_final.zkey" \
    "$CONTRACTS_DIR/src/Groth16Verifier.sol"

echo "=== Build complete ==="
echo "Artifacts:"
echo "  - Circuit WASM: $BUILD_DIR/withdraw_js/withdraw.wasm"
echo "  - Final zkey:   $BUILD_DIR/withdraw_final.zkey"
echo "  - Verifier:     $CONTRACTS_DIR/src/Groth16Verifier.sol"
