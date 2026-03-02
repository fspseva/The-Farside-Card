// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "poseidon-solidity/contracts/PoseidonT3.sol";

/// @title IVerifier - Interface for the Groth16 verifier
interface IVerifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[5] calldata _pubSignals
    ) external view returns (bool);
}

/// @title StealthPool - Privacy pool with Tornado Cash-style ZK deposits and withdrawals
/// @notice Fixed denomination USDC pool using Groth16 proofs and Poseidon-based Merkle tree
contract StealthPool {
    using SafeERC20 for IERC20;

    // --- Constants ---
    uint256 public constant MERKLE_TREE_DEPTH = 16;
    uint256 public constant MAX_LEAVES = 2 ** MERKLE_TREE_DEPTH; // 65536
    uint256 public constant ROOT_HISTORY_SIZE = 30;

    // Field modulus for BN254
    uint256 constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // --- Zero values for empty Merkle tree (Poseidon) ---
    uint256 constant Z_0 = 0;
    uint256 constant Z_1 = 14744269619966411208579211824598458697587494354926760081771325075741142829156;
    uint256 constant Z_2 = 7423237065226347324353380772367382631490014989348495481811164164159255474657;
    uint256 constant Z_3 = 11286972368698509976183087595462810875513684078608517520839298933882497716792;
    uint256 constant Z_4 = 3607627140608796879659380071776844901612302623152076817094415224584923813162;
    uint256 constant Z_5 = 19712377064642672829441595136074946683621277828620209496774504837737984048981;
    uint256 constant Z_6 = 20775607673010627194014556968476266066927294572720319469184847051418138353016;
    uint256 constant Z_7 = 3396914609616007258851405644437304192397291162432396347162513310381425243293;
    uint256 constant Z_8 = 21551820661461729022865262380882070649935529853313286572328683688269863701601;
    uint256 constant Z_9 = 6573136701248752079028194407151022595060682063033565181951145966236778420039;
    uint256 constant Z_10 = 12413880268183407374852357075976609371175688755676981206018884971008854919922;
    uint256 constant Z_11 = 14271763308400718165336499097156975241954733520325982997864342600795471836726;
    uint256 constant Z_12 = 20066985985293572387227381049700832219069292839614107140851619262827735677018;
    uint256 constant Z_13 = 9394776414966240069580838672673694685292165040808226440647796406499139370960;
    uint256 constant Z_14 = 11331146992410411304059858900317123658895005918277453009197229807340014528524;
    uint256 constant Z_15 = 15819538789928229930262697811477882737253464456578333862691129291651619515538;
    uint256 constant Z_16 = 19217088683336594659449020493828377907203207941212636669271704950158751593251;

    // --- State ---
    IVerifier public immutable verifier;
    IERC20 public immutable token;
    uint256 public immutable denomination;

    uint256 public nextIndex;
    mapping(uint256 => uint256) public filledSubtrees;
    mapping(uint256 => uint256) public roots;
    uint256 public currentRootIndex;

    mapping(uint256 => bool) public nullifierHashes;
    mapping(uint256 => bool) public commitments;

    // --- Events ---
    event Deposit(uint256 indexed commitment, uint256 leafIndex, uint256 timestamp);
    event Withdrawal(address to, uint256 nullifierHash, address indexed relayer, uint256 fee);

    // --- Errors ---
    error InvalidDenomination();
    error CommitmentAlreadyUsed();
    error MerkleTreeFull();
    error InvalidProof();
    error NullifierAlreadySpent();
    error UnknownRoot();
    error InvalidFee();
    error InvalidCommitment();

    constructor(
        IVerifier _verifier,
        IERC20 _token,
        uint256 _denomination
    ) {
        verifier = _verifier;
        token = _token;
        denomination = _denomination;

        // Initialize filled subtrees with zero values
        filledSubtrees[0] = Z_0;
        filledSubtrees[1] = Z_1;
        filledSubtrees[2] = Z_2;
        filledSubtrees[3] = Z_3;
        filledSubtrees[4] = Z_4;
        filledSubtrees[5] = Z_5;
        filledSubtrees[6] = Z_6;
        filledSubtrees[7] = Z_7;
        filledSubtrees[8] = Z_8;
        filledSubtrees[9] = Z_9;
        filledSubtrees[10] = Z_10;
        filledSubtrees[11] = Z_11;
        filledSubtrees[12] = Z_12;
        filledSubtrees[13] = Z_13;
        filledSubtrees[14] = Z_14;
        filledSubtrees[15] = Z_15;

        // Initial root = Z_16 (root of empty tree)
        roots[0] = Z_16;
    }

    /// @notice Deposit tokens into the pool
    /// @param commitment The Poseidon hash commitment = Poseidon(nullifier, secret)
    function deposit(uint256 commitment) external {
        if (commitment >= FIELD_SIZE || commitment == 0) revert InvalidCommitment();
        if (commitments[commitment]) revert CommitmentAlreadyUsed();
        if (nextIndex >= MAX_LEAVES) revert MerkleTreeFull();

        commitments[commitment] = true;
        uint256 leafIndex = _insert(commitment);

        token.safeTransferFrom(msg.sender, address(this), denomination);

        emit Deposit(commitment, leafIndex, block.timestamp);
    }

    /// @notice Withdraw tokens from the pool using a ZK proof
    /// @param proof The Groth16 proof (a, b, c)
    /// @param root The Merkle root to verify against
    /// @param nullifierHash The nullifier hash (prevents double-spend)
    /// @param recipient The address to receive tokens
    /// @param relayer The relayer address (receives fee)
    /// @param fee The relayer fee (deducted from denomination)
    function withdraw(
        uint[8] calldata proof,
        uint256 root,
        uint256 nullifierHash,
        address payable recipient,
        address payable relayer,
        uint256 fee
    ) external {
        if (fee > denomination) revert InvalidFee();
        if (nullifierHashes[nullifierHash]) revert NullifierAlreadySpent();
        if (!isKnownRoot(root)) revert UnknownRoot();

        // Verify proof
        // Public signals: [root, nullifierHash, recipient, relayer, fee]
        uint[5] memory pubSignals = [
            root,
            nullifierHash,
            uint256(uint160(address(recipient))),
            uint256(uint160(address(relayer))),
            fee
        ];

        bool valid = verifier.verifyProof(
            [proof[0], proof[1]],
            [[proof[2], proof[3]], [proof[4], proof[5]]],
            [proof[6], proof[7]],
            pubSignals
        );
        if (!valid) revert InvalidProof();

        nullifierHashes[nullifierHash] = true;

        // Transfer tokens
        if (fee > 0) {
            token.safeTransfer(relayer, fee);
        }
        token.safeTransfer(recipient, denomination - fee);

        emit Withdrawal(recipient, nullifierHash, relayer, fee);
    }

    /// @notice Check if a root is in the recent root history
    function isKnownRoot(uint256 root) public view returns (bool) {
        if (root == 0) return false;
        uint256 idx = currentRootIndex;
        for (uint256 i = 0; i < ROOT_HISTORY_SIZE; i++) {
            if (roots[idx] == root) return true;
            if (idx == 0) {
                idx = ROOT_HISTORY_SIZE - 1;
            } else {
                idx--;
            }
        }
        return false;
    }

    /// @notice Get the latest Merkle root
    function getLastRoot() external view returns (uint256) {
        return roots[currentRootIndex];
    }

    // --- Internal: Incremental Merkle Tree ---

    function _insert(uint256 leaf) internal returns (uint256 index) {
        index = nextIndex;
        uint256 currentHash = leaf;
        uint256 left;
        uint256 right;

        for (uint256 i = 0; i < MERKLE_TREE_DEPTH; i++) {
            if (index % 2 == 0) {
                left = currentHash;
                right = _zeros(i);
                filledSubtrees[i] = currentHash;
            } else {
                left = filledSubtrees[i];
                right = currentHash;
            }
            currentHash = _hashLeftRight(left, right);
            index /= 2;
        }

        currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        roots[currentRootIndex] = currentHash;
        nextIndex++;

        return nextIndex - 1;
    }

    function _hashLeftRight(uint256 left, uint256 right) internal pure returns (uint256) {
        return PoseidonT3.hash([left, right]);
    }

    function _zeros(uint256 i) internal pure returns (uint256) {
        if (i == 0) return Z_0;
        if (i == 1) return Z_1;
        if (i == 2) return Z_2;
        if (i == 3) return Z_3;
        if (i == 4) return Z_4;
        if (i == 5) return Z_5;
        if (i == 6) return Z_6;
        if (i == 7) return Z_7;
        if (i == 8) return Z_8;
        if (i == 9) return Z_9;
        if (i == 10) return Z_10;
        if (i == 11) return Z_11;
        if (i == 12) return Z_12;
        if (i == 13) return Z_13;
        if (i == 14) return Z_14;
        if (i == 15) return Z_15;
        if (i == 16) return Z_16;
        revert("Index out of bounds");
    }
}
