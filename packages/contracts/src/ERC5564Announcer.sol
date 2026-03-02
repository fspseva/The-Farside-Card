// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC-5564 Announcer
/// @notice Emits Announcement events for stealth address payments (Scheme 1 = secp256k1)
contract ERC5564Announcer {
    /// @notice Emitted when a stealth address payment is announced
    /// @param schemeId The stealth address scheme (1 = secp256k1)
    /// @param stealthAddress The generated stealth address
    /// @param caller The address that made the announcement
    /// @param ephemeralPubKey The ephemeral public key used to derive the stealth address
    /// @param metadata Additional metadata (view tag as first byte)
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    /// @notice Announce a stealth address payment
    /// @param schemeId The stealth address scheme ID (use 1 for secp256k1)
    /// @param stealthAddress The stealth address being paid
    /// @param ephemeralPubKey The ephemeral public key (33 bytes compressed)
    /// @param metadata View tag (1 byte) + any additional data
    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes memory ephemeralPubKey,
        bytes memory metadata
    ) external {
        emit Announcement(schemeId, stealthAddress, msg.sender, ephemeralPubKey, metadata);
    }
}
