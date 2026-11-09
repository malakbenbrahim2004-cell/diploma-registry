# DiplomaRegistry : émission et vérification de diplômes sur blockchain

Projet de fin de module « Technologie Blockchain », ENSA Fès.
Équipe : Ton Nom, Camarade 2, Camarade 3.

## Principe

Le hash SHA-256 du PDF d'un diplôme est ancré sur la blockchain par une institution autorisée.
Un tiers peut vérifier l'authenticité d'un diplôme en chargeant le PDF : aucune donnée personnelle
n'est stockée on-chain (RGPD), uniquement des hash, des adresses et des identifiants.

## Architecture

- `contracts/DiplomaRegistry.sol` : smart contract (Solidity 0.8.34, OpenZeppelin AccessControl)
- `test/DiplomaRegistry.ts` : 18 tests Hardhat (couverture 100 %)
- `scripts/` : scripts de déploiement (local et Sepolia)
- `frontend/` : dApp React + Vite + ethers.js (institution, étudiant, vérificateur, historique)

## Prérequis

- Node.js 20 ou plus
- MetaMask
- Git

## Installation

```
git clone <URL_DU_DEPOT>
cd diploma-registry
npm install
cd frontend
npm install --legacy-peer-deps
```

## Tests et couverture

```
npx hardhat test
npx hardhat test --coverage
```

## Exécution en local (démo reproductible)

1. Terminal 1 : `npx hardhat node`
2. Terminal 2 : `npx hardhat run scripts/deploy.ts --network localhost`
3. Copier l'adresse du contrat dans `frontend/src/contract.ts` (`CONTRACT_ADDRESS`, `RPC_URL = "http://127.0.0.1:8545"`).
4. Dans `frontend/src/App.tsx`, mettre l'identifiant de chaîne `0x7a69` (Hardhat Local) dans la fonction `basculerSurSepolia`.
5. Terminal 3 : `cd frontend && npm run dev`, puis ouvrir http://localhost:5173
6. MetaMask : ajouter le réseau Hardhat Local (RPC http://127.0.0.1:8545, chaîne 31337) et importer le compte #1 (émetteur).

## Déploiement Sepolia

1. `npx hardhat keystore set SEPOLIA_RPC_URL` et `npx hardhat keystore set SEPOLIA_PRIVATE_KEY`
2. `npx hardhat run scripts/deploy-sepolia.ts --network sepolia`
3. Mettre l'adresse obtenue dans `frontend/src/contract.ts`.

Contrat déployé : `0x766D687300c05894B0395B35a46A5746cEFa6817` (Sepolia).

## Fonctionnalités

| Réf. | Fonction |
|---|---|
| F1 | `issueDiploma` : ancrage du hash |
| F2 | `revokeDiploma` : révocation avec motif |
| F3 | `verify` : vérification publique |
| F4 | Contrôle d'accès (rôle ISSUER_ROLE) |
| F5 | Événements Issued et Revoked |
| F6 | Interface institution (hash SHA-256 côté client) |
| F7 | Espace étudiant et QR code |
| F8 | Vérification publique par PDF ou QR |
| F9 | Historique des émissions |

## Sécurité

- Contrôle d'accès par rôles (AccessControl) ; seul l'émetteur d'origine ou l'admin peut révoquer.
- Aucun appel externe dans le contrat : pas de réentrance possible.
- Validation des entrées (adresse nulle, hash vide, doublon) avec des erreurs personnalisées.
- Rotation de clé : `revokeRole` puis `grantRole`.