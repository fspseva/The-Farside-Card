import { poseidonHash2 } from "./poseidon.js";
import {
  getPublicClient,
  STEALTH_POOL_ABI,
  ADDRESSES,
  getPoolAddress,
} from "./contracts.js";

const DEPTH = 16;

// Zero values matching StealthPool.sol exactly
const ZEROS: bigint[] = [
  0n,
  14744269619966411208579211824598458697587494354926760081771325075741142829156n,
  7423237065226347324353380772367382631490014989348495481811164164159255474657n,
  11286972368698509976183087595462810875513684078608517520839298933882497716792n,
  3607627140608796879659380071776844901612302623152076817094415224584923813162n,
  19712377064642672829441595136074946683621277828620209496774504837737984048981n,
  20775607673010627194014556968476266066927294572720319469184847051418138353016n,
  3396914609616007258851405644437304192397291162432396347162513310381425243293n,
  21551820661461729022865262380882070649935529853313286572328683688269863701601n,
  6573136701248752079028194407151022595060682063033565181951145966236778420039n,
  12413880268183407374852357075976609371175688755676981206018884971008854919922n,
  14271763308400718165336499097156975241954733520325982997864342600795471836726n,
  20066985985293572387227381049700832219069292839614107140851619262827735677018n,
  9394776414966240069580838672673694685292165040808226440647796406499139370960n,
  11331146992410411304059858900317123658895005918277453009197229807340014528524n,
  15819538789928229930262697811477882737253464456578333862691129291651619515538n,
  19217088683336594659449020493828377907203207941212636669271704950158751593251n,
];

export class IncrementalMerkleTree {
  private depth: number;
  private leaves: bigint[] = [];
  private filledSubtrees: bigint[];
  private _currentRoot: bigint;

  constructor(depth: number = DEPTH) {
    this.depth = depth;
    this.filledSubtrees = ZEROS.slice(0, depth).map((z) => z);
    this._currentRoot = ZEROS[depth]; // empty tree root
  }

  get nextIndex(): number {
    return this.leaves.length;
  }

  insert(leaf: bigint): number {
    const index = this.leaves.length;
    this.leaves.push(leaf);

    let currentHash = leaf;
    let currentIndex = index;

    for (let i = 0; i < this.depth; i++) {
      let left: bigint, right: bigint;
      if (currentIndex % 2 === 0) {
        left = currentHash;
        right = ZEROS[i];
        this.filledSubtrees[i] = currentHash;
      } else {
        left = this.filledSubtrees[i];
        right = currentHash;
      }
      currentHash = poseidonHash2(left, right);
      currentIndex = Math.floor(currentIndex / 2);
    }

    this._currentRoot = currentHash;
    return index;
  }

  getRoot(): bigint {
    return this._currentRoot;
  }

  getPath(leafIndex: number): { pathElements: bigint[]; pathIndices: number[] } {
    if (leafIndex >= this.leaves.length) {
      throw new Error(`Leaf index ${leafIndex} out of range (${this.leaves.length} leaves)`);
    }

    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];

    // Build full tree layer by layer to get siblings
    let currentLayer = [...this.leaves];

    // Pad current layer to even length with zeros
    while (currentLayer.length < 2 ** this.depth) {
      // Don't pad the full thing, just compute what we need level by level
      break;
    }

    let idx = leafIndex;

    for (let level = 0; level < this.depth; level++) {
      // Pad to even if needed
      if (currentLayer.length % 2 !== 0) {
        currentLayer.push(ZEROS[level]);
      }
      // Also pad to cover our index's sibling
      while (currentLayer.length <= idx + 1) {
        currentLayer.push(ZEROS[level]);
      }

      pathIndices.push(idx % 2);

      if (idx % 2 === 0) {
        // Sibling is on the right
        pathElements.push(idx + 1 < currentLayer.length ? currentLayer[idx + 1] : ZEROS[level]);
      } else {
        // Sibling is on the left
        pathElements.push(currentLayer[idx - 1]);
      }

      // Compute next layer
      const nextLayer: bigint[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : ZEROS[level];
        nextLayer.push(poseidonHash2(left, right));
      }
      currentLayer = nextLayer;
      idx = Math.floor(idx / 2);
    }

    return { pathElements, pathIndices };
  }
}

// Pool-specific trees
const trees = new Map<string, IncrementalMerkleTree>();

export function getTree(poolAddress: string): IncrementalMerkleTree {
  const key = poolAddress.toLowerCase();
  if (!trees.has(key)) {
    trees.set(key, new IncrementalMerkleTree());
  }
  return trees.get(key)!;
}

export async function syncMerkleTreesFromChain(): Promise<void> {
  const publicClient = getPublicClient();

  const DEPOSIT_EVENT = {
    type: "event" as const,
    name: "Deposit" as const,
    inputs: [
      { name: "commitment", type: "uint256" as const, indexed: true },
      { name: "leafIndex", type: "uint256" as const, indexed: false },
      { name: "timestamp", type: "uint256" as const, indexed: false },
    ],
  };

  for (const pool of [ADDRESSES.StealthPool10, ADDRESSES.StealthPool100]) {
    console.log(`[MerkleTree] Syncing ${pool}...`);

    // Check on-chain nextIndex to see if there are any deposits
    const nextIdx = await publicClient.readContract({
      address: pool,
      abi: STEALTH_POOL_ABI,
      functionName: "nextIndex",
    });

    if (Number(nextIdx) === 0) {
      console.log(`[MerkleTree] ${pool}: No deposits yet, skipping`);
      continue;
    }

    // Scan logs in chunks (Alchemy free tier: max 10 blocks per request)
    const currentBlock = await publicClient.getBlockNumber();
    const CHUNK_SIZE = 10n;
    // Only scan last 2000 blocks (~1 hour on Base Sepolia) to keep startup fast
    const startBlock = currentBlock > 2000n ? currentBlock - 2000n : 0n;

    const allLogs: any[] = [];

    for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
      const to = from + CHUNK_SIZE - 1n > currentBlock ? currentBlock : from + CHUNK_SIZE - 1n;
      const logs = await publicClient.getLogs({
        address: pool,
        event: DEPOSIT_EVENT,
        fromBlock: from,
        toBlock: to,
      });
      allLogs.push(...logs);
    }

    const tree = getTree(pool);

    // Sort by leafIndex to insert in order
    const sorted = [...allLogs].sort((a, b) => {
      const aIdx = Number(a.args.leafIndex!);
      const bIdx = Number(b.args.leafIndex!);
      return aIdx - bIdx;
    });

    for (const log of sorted) {
      tree.insert(log.args.commitment as bigint);
    }

    console.log(`[MerkleTree] ${pool}: ${sorted.length} deposits synced, root = ${tree.getRoot()}`);
  }
}
