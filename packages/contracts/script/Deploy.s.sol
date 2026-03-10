// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/StealthPool.sol";
import "../src/Groth16Verifier.sol";
import "../src/ERC5564Announcer.sol";
import "../src/ERC6538Registry.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdc = vm.envAddress("CIRCLE_USDC");

        vm.startBroadcast(deployerKey);

        // 1. Deploy Groth16Verifier
        Groth16Verifier verifier = new Groth16Verifier();
        console.log("Groth16Verifier:", address(verifier));

        // 2. Deploy StealthPool for 10 USDC (10e6)
        StealthPool pool10 = new StealthPool(
            IVerifier(address(verifier)),
            IERC20(usdc),
            10e6 // 10 USDC
        );
        console.log("StealthPool (10 USDC):", address(pool10));

        // 3. Deploy StealthPool for 100 USDC (100e6)
        StealthPool pool100 = new StealthPool(
            IVerifier(address(verifier)),
            IERC20(usdc),
            100e6 // 100 USDC
        );
        console.log("StealthPool (100 USDC):", address(pool100));

        // 4. Deploy ERC5564Announcer
        ERC5564Announcer announcer = new ERC5564Announcer();
        console.log("ERC5564Announcer:", address(announcer));

        // 5. Deploy ERC6538Registry
        ERC6538Registry registry = new ERC6538Registry();
        console.log("ERC6538Registry:", address(registry));

        vm.stopBroadcast();
    }
}
