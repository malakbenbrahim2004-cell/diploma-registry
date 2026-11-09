export const CONTRACT_ADDRESS = "0x766D687300c05894B0395B35a46A5746cEFa6817";
export const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
export const DEPLOY_BLOCK = 12083700;

export const ABI = [
  "function issueDiploma(address student, bytes32 diplomaHash, string metadataURI) returns (uint256)",
  "function revokeDiploma(uint256 diplomaId, string reason)",
  "function verify(uint256 diplomaId, bytes32 diplomaHash) view returns (bool valid, address issuer, uint64 issuedAt, bool revoked)",
  "function getIdByHash(bytes32 diplomaHash) view returns (uint256)",
  "function diplomaCount() view returns (uint256)",
  "function getDiploma(uint256 diplomaId) view returns (tuple(bytes32 hash, address issuer, address student, uint64 issuedAt, bool revoked, string metadataURI, string revokeReason))",
  "event Issued(uint256 indexed diplomaId, address indexed issuer, address indexed student, bytes32 diplomaHash, string metadataURI)",
  "event Revoked(uint256 indexed diplomaId, address indexed revokedBy, string reason)",
];