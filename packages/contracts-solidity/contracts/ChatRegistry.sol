// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChatRegistry
 * @dev Manages user identities (public encryption keys) and logs messages with optional tips.
 */
contract ChatRegistry {
    // Mapping from wallet address to their public encryption key
    mapping(address => bytes) public encryptionKeys;

    // Event emitted when a new identity is registered
    event IdentityRegistered(address indexed user, bytes encryptionKey);

    // Event emitted when a message is sent (transaction logged)
    // messageHash is the SHA256/Keccak256 hash of the encrypted payload
    event MessageSent(
        address indexed from,
        address indexed to,
        bytes32 messageHash,
        uint256 tipAmount,
        uint256 timestamp
    );

    /**
     * @dev Register or update the caller's public encryption key.
     * @param _encryptionKey The public key used for encrypting messages to this user.
     */
    function registerIdentity(bytes calldata _encryptionKey) external {
        encryptionKeys[msg.sender] = _encryptionKey;
        emit IdentityRegistered(msg.sender, _encryptionKey);
    }

    /**
     * @dev Log a message transaction on-chain and optionally send a tip.
     * @param _to The recipient of the message.
     * @param _messageHash The hash of the encrypted message for integrity.
     */
    function sendMessage(address _to, bytes32 _messageHash) external payable {
        require(_to != address(0), "Cannot send to zero address");
        
        // If a tip was sent, forward it to the recipient
        if (msg.value > 0) {
            (bool success, ) = _to.call{value: msg.value}("");
            require(success, "Tip transfer failed");
        }

        emit MessageSent(
            msg.sender,
            _to,
            _messageHash,
            msg.value,
            block.timestamp
        );
    }

    /**
     * @dev Get the public encryption key for a specific user.
     */
    function getEncryptionKey(address _user) external view returns (bytes memory) {
        return encryptionKeys[_user];
    }
}
