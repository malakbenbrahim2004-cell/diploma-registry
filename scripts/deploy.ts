import { network } from "hardhat";

const { ethers } = await network.connect();

const [admin, issuer] = await ethers.getSigners();

const registry = await ethers.deployContract("DiplomaRegistry", [admin.address]);
await registry.waitForDeployment();

const ISSUER_ROLE = ethers.id("ISSUER_ROLE");
await (await registry.grantRole(ISSUER_ROLE, issuer.address)).wait();

console.log("DiplomaRegistry déployé à :", await registry.getAddress());
console.log("Admin   :", admin.address);
console.log("Émetteur:", issuer.address);