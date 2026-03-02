// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestUSDC - A test ERC-20 token mimicking USDC (6 decimals, public mint)
contract TestUSDC is ERC20 {
    constructor() ERC20("Test USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Anyone can mint tokens for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
