#!/bin/bash
# Deploy all contracts to Arbitrum Sepolia
# Prerequisites: fund deployer wallet 0xA7B1EfBe2437f1f9B6CeE73aA593622e50d894f0 with ~0.01 ETH on Arb Sepolia
# Faucet: https://www.alchemy.com/faucets/arbitrum-sepolia
# Uses Circle's official USDC on Arb Sepolia: 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d

set -e
source ~/.zshenv 2>/dev/null
export $(grep -v '^#' ../../.env | xargs) 2>/dev/null

RPC_URL="https://arb-sepolia.g.alchemy.com/v2/$ALCHEMY_API_KEY"
CIRCLE_USDC="0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"

echo "=== Deploying to Arbitrum Sepolia ==="
echo "Deployer: 0xA7B1EfBe2437f1f9B6CeE73aA593622e50d894f0"
echo "Circle USDC: $CIRCLE_USDC"
echo ""

# Check balance
BALANCE=$(cast balance 0xA7B1EfBe2437f1f9B6CeE73aA593622e50d894f0 --rpc-url "$RPC_URL")
echo "Balance: $BALANCE wei"
if [ "$BALANCE" = "0" ]; then
    echo "ERROR: No ETH on Arb Sepolia. Fund the deployer wallet first."
    exit 1
fi

# Step 1: Deploy PoseidonT3 library
echo ""
echo "Step 1: Deploying PoseidonT3..."
POSEIDON_OUTPUT=$(forge create lib/poseidon-solidity/contracts/PoseidonT3.sol:PoseidonT3 \
    --rpc-url "$RPC_URL" \
    --private-key $DEPLOYER_PRIVATE_KEY \
    --broadcast 2>&1)
echo "$POSEIDON_OUTPUT"
POSEIDON_ADDR=$(echo "$POSEIDON_OUTPUT" | grep "Deployed to:" | awk '{print $3}')
echo "PoseidonT3: $POSEIDON_ADDR"

# Step 2: Deploy all other contracts
echo ""
echo "Step 2: Deploying main contracts..."
CIRCLE_USDC=$CIRCLE_USDC forge script script/Deploy.s.sol:Deploy \
    --rpc-url "$RPC_URL" \
    --private-key $DEPLOYER_PRIVATE_KEY \
    --broadcast \
    --libraries "lib/poseidon-solidity/contracts/PoseidonT3.sol:PoseidonT3:$POSEIDON_ADDR"

echo ""
echo "=== Deployment complete! ==="
echo "Update deployments/arb-sepolia.json with the addresses above."
echo "Circle USDC (Arb Sepolia): $CIRCLE_USDC"
