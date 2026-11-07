export const CONTRACT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
export const RPC_URL = "http://127.0.0.1:8545";

export const ABI = [
  "function issueDiploma(address student, bytes32 diplomaHash, string metadataURI) returns (uint256)",
  "function revokeDiploma(uint256 diplomaId, string reason)",
  "function verify(uint256 diplomaId, bytes32 diplomaHash) view returns (bool valid, address issuer, uint64 issuedAt, bool revoked)",
  "function getIdByHash(bytes32 diplomaHash) view returns (uint256)",
  "event Issued(uint256 indexed diplomaId, address indexed issuer, address indexed student, bytes32 diplomaHash, string metadataURI)",
  "event Revoked(uint256 indexed diplomaId, address indexed revokedBy, string reason)",
];