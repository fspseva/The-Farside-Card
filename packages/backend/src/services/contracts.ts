import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  type PublicClient,
  type WalletClient,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// --- Deployed addresses (Base Sepolia) ---
export const ADDRESSES = {
  TestUSDC: "0xF99b0dF2cfe19a4B016205bc3664c57BE1F91bE1" as const,
  Groth16Verifier: "0xDB6576f9126414cA0c58E704d5fDFeC89BCbEfB9" as const,
  StealthPool10: "0x95Ae9FE47Ad329846c4339814A1615d802560548" as const,
  StealthPool100: "0x4D54039cfE96AA7902f0b9F56E5966CA419D2625" as const,
  ERC5564Announcer: "0x57c914b7c433755360a302Aa8Ff2c9cAcA15800A" as const,
  ERC6538Registry: "0xd1f9e9639a07B14992f8F4874A12495D8907bBf1" as const,
};

// --- ABIs (minimal, only used functions) ---
export const STEALTH_POOL_ABI = parseAbi([
  "function deposit(uint256 commitment) external",
  "function withdraw(uint256[8] calldata proof, uint256 root, uint256 nullifierHash, address payable recipient, address payable relayer, uint256 fee) external",
  "function getLastRoot() external view returns (uint256)",
  "function nextIndex() external view returns (uint256)",
  "function isKnownRoot(uint256 root) external view returns (bool)",
  "function denomination() external view returns (uint256)",
  "event Deposit(uint256 indexed commitment, uint256 leafIndex, uint256 timestamp)",
  "event Withdrawal(address to, uint256 nullifierHash, address indexed relayer, uint256 fee)",
]);

export const TEST_USDC_ABI = parseAbi([
  "function mint(address to, uint256 amount) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

// --- RPC URL ---
function getRpcUrl(): string {
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (alchemyKey) {
    return `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`;
  }
  return "https://sepolia.base.org";
}

// --- Lazy clients ---
let _publicClient: PublicClient | null = null;
let _deployerClient: WalletClient | null = null;
let _relayerClient: WalletClient | null = null;

export function getPublicClient(): PublicClient {
  if (!_publicClient) {
    _publicClient = createPublicClient({
      chain: baseSepolia as Chain,
      transport: http(getRpcUrl()),
    });
  }
  return _publicClient;
}

export function getDeployerClient(): WalletClient {
  if (!_deployerClient) {
    const key = process.env.DEPLOYER_PRIVATE_KEY;
    if (!key) throw new Error("DEPLOYER_PRIVATE_KEY not set");
    const account = privateKeyToAccount(key as `0x${string}`);
    _deployerClient = createWalletClient({
      account,
      chain: baseSepolia as Chain,
      transport: http(getRpcUrl()),
    });
  }
  return _deployerClient;
}

export function getRelayerClient(): WalletClient {
  if (!_relayerClient) {
    const key = process.env.RELAYER_PRIVATE_KEY;
    if (!key) throw new Error("RELAYER_PRIVATE_KEY not set");
    const account = privateKeyToAccount(key as `0x${string}`);
    _relayerClient = createWalletClient({
      account,
      chain: baseSepolia as Chain,
      transport: http(getRpcUrl()),
    });
  }
  return _relayerClient;
}

export function getDeployerAddress(): `0x${string}` {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  return privateKeyToAccount(key as `0x${string}`).address;
}

export function getRelayerAddress(): `0x${string}` {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key) throw new Error("RELAYER_PRIVATE_KEY not set");
  return privateKeyToAccount(key as `0x${string}`).address;
}

export function getPoolAddress(denomination: number): `0x${string}` {
  if (denomination === 10_000_000) return ADDRESSES.StealthPool10;
  if (denomination === 100_000_000) return ADDRESSES.StealthPool100;
  throw new Error(`Unknown denomination: ${denomination}`);
}
