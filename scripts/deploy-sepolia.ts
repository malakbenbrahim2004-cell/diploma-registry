import { network } from "hardhat";

const { ethers } = await network.connect("sepolia");

const [deployer] = await ethers.getSigners();

const registry = await ethers.deployContract("DiplomaRegistry", [deployer.address]);
await registry.waitForDeployment();

const ISSUER_ROLE = ethers.id("ISSUER_ROLE");
await (await registry.grantRole(ISSUER_ROLE, deployer.address)).wait();

console.log("DiplomaRegistry déployé sur Sepolia à :", await registry.getAddress());
console.log("Admin et émetteur :", deployer.address);