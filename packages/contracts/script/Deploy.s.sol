// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TestUSDC.sol";
import "../src/StealthPool.sol";
import "../src/Groth16Verifier.sol";
import "../src/ERC5564Announcer.sol";
import "../src/ERC6538Registry.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy TestUSDC
        TestUSDC usdc = new TestUSDC();
        console.log("TestUSDC:", address(usdc));

        // 2. Deploy Groth16Verifier
        Groth16Verifier verifier = new Groth16Verifier();
        console.log("Groth16Verifier:", address(verifier));

        // 3. Deploy StealthPool for 10 USDC (10e6)
        StealthPool pool10 = new StealthPool(
            IVerifier(address(verifier)),
            IERC20(address(usdc)),
            10e6 // 10 USDC
        );
        console.log("StealthPool (10 USDC):", address(pool10));

        // 4. Deploy StealthPool for 100 USDC (100e6)
        StealthPool pool100 = new StealthPool(
            IVerifier(address(verifier)),
            IERC20(address(usdc)),
            100e6 // 100 USDC
        );
        console.log("StealthPool (100 USDC):", address(pool100));

        // 5. Deploy ERC5564Announcer
        ERC5564Announcer announcer = new ERC5564Announcer();
        console.log("ERC5564Announcer:", address(announcer));

        // 6. Deploy ERC6538Registry
        ERC6538Registry registry = new ERC6538Registry();
        console.log("ERC6538Registry:", address(registry));

        vm.stopBroadcast();

        // Write deployment addresses (logged above, user can also parse from broadcast)
    }
}
