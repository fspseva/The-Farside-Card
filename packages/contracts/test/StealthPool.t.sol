// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TestUSDC.sol";
import "../src/StealthPool.sol";
import "../src/Groth16Verifier.sol";

contract StealthPoolTest is Test {
    TestUSDC usdc;
    Groth16Verifier verifier;
    StealthPool pool;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address relayer = makeAddr("relayer");

    uint256 constant DENOMINATION = 100e6; // 100 USDC

    function setUp() public {
        usdc = new TestUSDC();
        verifier = new Groth16Verifier();
        pool = new StealthPool(
            IVerifier(address(verifier)),
            IERC20(address(usdc)),
            DENOMINATION
        );
    }

    function test_Deposit() public {
        uint256 commitment = 12345678901234567890;

        // Mint USDC to alice
        usdc.mint(alice, DENOMINATION);

        vm.startPrank(alice);
        usdc.approve(address(pool), DENOMINATION);
        pool.deposit(commitment);
        vm.stopPrank();

        // Verify state
        assertEq(usdc.balanceOf(address(pool)), DENOMINATION);
        assertEq(pool.nextIndex(), 1);
        assertTrue(pool.commitments(commitment));
    }

    function test_DepositMultiple() public {
        uint256 commitment1 = 111111;
        uint256 commitment2 = 222222;

        usdc.mint(alice, DENOMINATION * 2);

        vm.startPrank(alice);
        usdc.approve(address(pool), DENOMINATION * 2);
        pool.deposit(commitment1);
        pool.deposit(commitment2);
        vm.stopPrank();

        assertEq(pool.nextIndex(), 2);
        assertEq(usdc.balanceOf(address(pool)), DENOMINATION * 2);
    }

    function test_RevertDuplicateCommitment() public {
        uint256 commitment = 12345;

        usdc.mint(alice, DENOMINATION * 2);

        vm.startPrank(alice);
        usdc.approve(address(pool), DENOMINATION * 2);
        pool.deposit(commitment);

        vm.expectRevert(StealthPool.CommitmentAlreadyUsed.selector);
        pool.deposit(commitment);
        vm.stopPrank();
    }

    function test_RevertZeroCommitment() public {
        usdc.mint(alice, DENOMINATION);

        vm.startPrank(alice);
        usdc.approve(address(pool), DENOMINATION);

        vm.expectRevert(StealthPool.InvalidCommitment.selector);
        pool.deposit(0);
        vm.stopPrank();
    }

    function test_IsKnownRoot() public {
        // The initial empty root should be known
        uint256 emptyRoot = pool.getLastRoot();
        assertTrue(pool.isKnownRoot(emptyRoot));
        assertFalse(pool.isKnownRoot(0));
        assertFalse(pool.isKnownRoot(99999));
    }

    function test_RootHistoryAfterDeposit() public {
        uint256 rootBefore = pool.getLastRoot();

        uint256 commitment = 12345678901234567890;
        usdc.mint(alice, DENOMINATION);

        vm.startPrank(alice);
        usdc.approve(address(pool), DENOMINATION);
        pool.deposit(commitment);
        vm.stopPrank();

        uint256 rootAfter = pool.getLastRoot();

        // Both roots should be known
        assertTrue(pool.isKnownRoot(rootBefore));
        assertTrue(pool.isKnownRoot(rootAfter));
        assertTrue(rootBefore != rootAfter);
    }

    function test_DeploymentAddresses() public view {
        assertTrue(address(usdc) != address(0));
        assertTrue(address(verifier) != address(0));
        assertTrue(address(pool) != address(0));
        assertEq(pool.denomination(), DENOMINATION);
    }
}
