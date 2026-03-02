// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC-6538 Stealth Meta-Address Registry
/// @notice Allows users to register their stealth meta-address for a given scheme
contract ERC6538Registry {
    /// @notice Mapping: registrant => schemeId => stealth meta-address
    mapping(address => mapping(uint256 => bytes)) public stealthMetaAddressOf;

    /// @notice Emitted when a stealth meta-address is registered
    event StealthMetaAddressSet(
        address indexed registrant,
        uint256 indexed schemeId,
        bytes stealthMetaAddress
    );

    /// @notice Register a stealth meta-address for a given scheme
    /// @param schemeId The scheme ID (1 = secp256k1)
    /// @param stealthMetaAddress The encoded stealth meta-address (66 bytes: spend_pub + view_pub)
    function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external {
        stealthMetaAddressOf[msg.sender][schemeId] = stealthMetaAddress;
        emit StealthMetaAddressSet(msg.sender, schemeId, stealthMetaAddress);
    }
}
