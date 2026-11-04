// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract DiplomaRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Diploma {
        bytes32 hash;
        address issuer;
        address student;
        uint64 issuedAt;
        bool revoked;
        string metadataURI;
        string revokeReason;
    }

    uint256 public diplomaCount;
    mapping(uint256 => Diploma) private diplomas;
    mapping(bytes32 => uint256) private hashToId; // 0 = inexistant

    event Issued(
        uint256 indexed diplomaId,
        address indexed issuer,
        address indexed student,
        bytes32 diplomaHash,
        string metadataURI
    );
    event Revoked(uint256 indexed diplomaId, address indexed revokedBy, string reason);

    error ZeroAddress();
    error EmptyHash();
    error AlreadyIssued();
    error DiplomaNotFound();
    error AlreadyRevoked();
    error NotOriginalIssuer();

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // F1 : émission (seuls les émetteurs autorisés)
    function issueDiploma(
        address student,
        bytes32 diplomaHash,
        string calldata metadataURI
    ) external onlyRole(ISSUER_ROLE) returns (uint256 id) {
        if (student == address(0)) revert ZeroAddress();
        if (diplomaHash == bytes32(0)) revert EmptyHash();
        if (hashToId[diplomaHash] != 0) revert AlreadyIssued();

        id = ++diplomaCount;
        diplomas[id] = Diploma({
            hash: diplomaHash,
            issuer: msg.sender,
            student: student,
            issuedAt: uint64(block.timestamp),
            revoked: false,
            metadataURI: metadataURI,
            revokeReason: ""
        });
        hashToId[diplomaHash] = id;

        emit Issued(id, msg.sender, student, diplomaHash, metadataURI);
    }

    // F2 : révocation avec motif
    function revokeDiploma(uint256 diplomaId, string calldata reason)
        external
        onlyRole(ISSUER_ROLE)
    {
        Diploma storage d = diplomas[diplomaId];
        if (d.issuedAt == 0) revert DiplomaNotFound();
        if (d.revoked) revert AlreadyRevoked();
        if (d.issuer != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotOriginalIssuer();
        }

        d.revoked = true;
        d.revokeReason = reason;

        emit Revoked(diplomaId, msg.sender, reason);
    }

    // F3 : vérification publique (lecture seule, gratuite)
    function verify(uint256 diplomaId, bytes32 diplomaHash)
        external
        view
        returns (bool valid, address issuer, uint64 issuedAt, bool revoked)
    {
        Diploma storage d = diplomas[diplomaId];
        if (d.issuedAt == 0 || d.hash != diplomaHash) {
            return (false, address(0), 0, false);
        }
        return (!d.revoked, d.issuer, d.issuedAt, d.revoked);
    }

    // Aide pour la dApp : retrouver un diplôme depuis le hash du PDF
    function getIdByHash(bytes32 diplomaHash) external view returns (uint256) {
        return hashToId[diplomaHash];
    }

    function getDiploma(uint256 diplomaId) external view returns (Diploma memory) {
        if (diplomas[diplomaId].issuedAt == 0) revert DiplomaNotFound();
        return diplomas[diplomaId];
    }
}