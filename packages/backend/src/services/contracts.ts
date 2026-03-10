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
import { baseSepolia, sepolia, arbitrumSepolia } from "viem/chains";

// --- Per-chain deployed addresses ---
const CHAIN_ADDRESSES: Record<number, {
  USDC: `0x${string}`;
  Groth16Verifier: `0x${string}`;
  StealthPool10: `0x${string}`;
  StealthPool100: `0x${string}`;
  ERC5564Announcer: `0x${string}`;
  ERC6538Registry: `0x${string}`;
}> = {
  // Base Sepolia
  84532: {
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    Groth16Verifier: "0xDB6576f9126414cA0c58E704d5fDFeC89BCbEfB9",
    StealthPool10: "0x9CD59E5eBC6c9C5188F115Cb7697293E77734C1d",
    StealthPool100: "0x9284556402A696BaEb27e160d210eF73C1057969",
    ERC5564Announcer: "0x57c914b7c433755360a302Aa8Ff2c9cAcA15800A",
    ERC6538Registry: "0xd1f9e9639a07B14992f8F4874A12495D8907bBf1",
  },
  // Eth Sepolia
  11155111: {
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    Groth16Verifier: "0x6F466b9ECc083E585C41a584b25fBA30885C64B8",
    StealthPool10: "0x45f2B9fA4F39ad69Ee562D43b74F4CaEc28c7c62",
    StealthPool100: "0xF8373Bdda4C2b07659F31f9fdAC446198E0B4e33",
    ERC5564Announcer: "0xbE02fF1b909DC6a560533162FA7FC888bd240EdC",
    ERC6538Registry: "0x8f4FBD57C898CC542F497B4a1e0C00012e4948B2",
  },
  // Arbitrum Sepolia
  421614: {
    USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    Groth16Verifier: "0xDB6576f9126414cA0c58E704d5fDFeC89BCbEfB9",
    StealthPool10: "0x95Ae9FE47Ad329846c4339814A1615d802560548",
    StealthPool100: "0x4D54039cfE96AA7902f0b9F56E5966CA419D2625",
    ERC5564Announcer: "0x57c914b7c433755360a302Aa8Ff2c9cAcA15800A",
    ERC6538Registry: "0xd1f9e9639a07B14992f8F4874A12495D8907bBf1",
  },
};

// Default chain (backwards compat)
export const DEFAULT_CHAIN_ID = 84532;
export const SUPPORTED_CHAIN_IDS = [84532, 11155111, 421614] as const;

// Legacy export for code that doesn't pass chainId yet
export const ADDRESSES = CHAIN_ADDRESSES[DEFAULT_CHAIN_ID];

export function getAddresses(chainId: number) {
  const addrs = CHAIN_ADDRESSES[chainId];
  if (!addrs) throw new Error(`Unsupported chain: ${chainId}`);
  return addrs;
}

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

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

// --- Chain configs ---
const CHAIN_CONFIG: Record<number, { chain: Chain; rpcPath: string; fallback: string }> = {
  84532: { chain: baseSepolia as Chain, rpcPath: "base-sepolia", fallback: "https://sepolia.base.org" },
  11155111: { chain: sepolia as Chain, rpcPath: "eth-sepolia", fallback: "https://rpc.sepolia.org" },
  421614: { chain: arbitrumSepolia as Chain, rpcPath: "arb-sepolia", fallback: "https://sepolia-rollup.arbitrum.io/rpc" },
};

function getRpcUrl(chainId: number): string {
  const config = CHAIN_CONFIG[chainId];
  if (!config) throw new Error(`Unsupported chain: ${chainId}`);
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (alchemyKey) {
    return `https://${config.rpcPath}.g.alchemy.com/v2/${alchemyKey}`;
  }
  return config.fallback;
}

// --- Per-chain client caches ---
const publicClients = new Map<number, PublicClient>();
const deployerClients = new Map<number, WalletClient>();

export function getPublicClient(chainId: number = DEFAULT_CHAIN_ID): PublicClient {
  if (!publicClients.has(chainId)) {
    const config = CHAIN_CONFIG[chainId];
    if (!config) throw new Error(`Unsupported chain: ${chainId}`);
    publicClients.set(chainId, createPublicClient({
      chain: config.chain,
      transport: http(getRpcUrl(chainId)),
    }));
  }
  return publicClients.get(chainId)!;
}

export function getDeployerClient(chainId: number = DEFAULT_CHAIN_ID): WalletClient {
  if (!deployerClients.has(chainId)) {
    const key = process.env.DEPLOYER_PRIVATE_KEY;
    if (!key) throw new Error("DEPLOYER_PRIVATE_KEY not set");
    const config = CHAIN_CONFIG[chainId];
    if (!config) throw new Error(`Unsupported chain: ${chainId}`);
    const account = privateKeyToAccount(key as `0x${string}`);
    deployerClients.set(chainId, createWalletClient({
      account,
      chain: config.chain,
      transport: http(getRpcUrl(chainId)),
    }));
  }
  return deployerClients.get(chainId)!;
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

export function getPoolAddress(denomination: number, chainId: number = DEFAULT_CHAIN_ID): `0x${string}` {
  const addrs = getAddresses(chainId);
  if (denomination === 10_000_000) return addrs.StealthPool10;
  if (denomination === 100_000_000) return addrs.StealthPool100;
  throw new Error(`Unknown denomination: ${denomination}`);
}
