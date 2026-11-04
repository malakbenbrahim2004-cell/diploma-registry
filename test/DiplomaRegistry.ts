import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("DiplomaRegistry", function () {
  const ISSUER_ROLE = ethers.id("ISSUER_ROLE");
  const hash1 = ethers.keccak256(ethers.toUtf8Bytes("diplome-1"));
  const hash2 = ethers.keccak256(ethers.toUtf8Bytes("diplome-2"));
  const uri = "ipfs://metadata-1";

  let registry: any;
  let admin: any, issuer: any, issuer2: any, student: any, other: any;

  beforeEach(async function () {
    [admin, issuer, issuer2, student, other] = await ethers.getSigners();
    registry = await ethers.deployContract("DiplomaRegistry", [admin.address]);
    await registry.connect(admin).grantRole(ISSUER_ROLE, issuer.address);
    await registry.connect(admin).grantRole(ISSUER_ROLE, issuer2.address);
  });

  describe("Déploiement", function () {
    it("donne le rôle admin à l'adresse fournie", async function () {
      const adminRole = await registry.DEFAULT_ADMIN_ROLE();
      expect(await registry.hasRole(adminRole, admin.address)).to.equal(true);
    });

    it("refuse une adresse admin nulle", async function () {
      await expect(
        ethers.deployContract("DiplomaRegistry", [ethers.ZeroAddress])
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });
  });

  describe("issueDiploma (F1, F4, F5)", function () {
    it("émet un diplôme et l'événement Issued", async function () {
      await expect(registry.connect(issuer).issueDiploma(student.address, hash1, uri))
        .to.emit(registry, "Issued")
        .withArgs(1n, issuer.address, student.address, hash1, uri);
      expect(await registry.diplomaCount()).to.equal(1n);
      expect(await registry.getIdByHash(hash1)).to.equal(1n);
    });

    it("refuse un non-émetteur", async function () {
      await expect(
        registry.connect(other).issueDiploma(student.address, hash1, uri)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("refuse un hash déjà émis", async function () {
      await registry.connect(issuer).issueDiploma(student.address, hash1, uri);
      await expect(
        registry.connect(issuer).issueDiploma(student.address, hash1, uri)
      ).to.be.revertedWithCustomError(registry, "AlreadyIssued");
    });

    it("refuse un étudiant à l'adresse nulle", async function () {
      await expect(
        registry.connect(issuer).issueDiploma(ethers.ZeroAddress, hash1, uri)
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("refuse un hash vide", async function () {
      await expect(
        registry.connect(issuer).issueDiploma(student.address, ethers.ZeroHash, uri)
      ).to.be.revertedWithCustomError(registry, "EmptyHash");
    });
  });

  describe("verify (F3)", function () {
    beforeEach(async function () {
      await registry.connect(issuer).issueDiploma(student.address, hash1, uri);
    });

    it("valide un diplôme authentique", async function () {
      const [valid, who, issuedAt, revoked] = await registry.verify(1n, hash1);
      expect(valid).to.equal(true);
      expect(who).to.equal(issuer.address);
      expect(issuedAt > 0n).to.equal(true);
      expect(revoked).to.equal(false);
    });

    it("invalide un mauvais hash (PDF falsifié)", async function () {
      const [valid] = await registry.verify(1n, hash2);
      expect(valid).to.equal(false);
    });

    it("invalide un identifiant inexistant", async function () {
      const [valid] = await registry.verify(99n, hash1);
      expect(valid).to.equal(false);
    });
  });

  describe("revokeDiploma (F2, F5)", function () {
    beforeEach(async function () {
      await registry.connect(issuer).issueDiploma(student.address, hash1, uri);
    });

    it("révoque et émet l'événement Revoked", async function () {
      await expect(registry.connect(issuer).revokeDiploma(1n, "fraude"))
        .to.emit(registry, "Revoked")
        .withArgs(1n, issuer.address, "fraude");
      const [valid, , , revoked] = await registry.verify(1n, hash1);
      expect(valid).to.equal(false);
      expect(revoked).to.equal(true);
    });

    it("refuse un non-émetteur", async function () {
      await expect(
        registry.connect(other).revokeDiploma(1n, "x")
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("refuse un autre émetteur que l'original", async function () {
      await expect(
        registry.connect(issuer2).revokeDiploma(1n, "x")
      ).to.be.revertedWithCustomError(registry, "NotOriginalIssuer");
    });

    it("refuse une double révocation", async function () {
      await registry.connect(issuer).revokeDiploma(1n, "erreur");
      await expect(
        registry.connect(issuer).revokeDiploma(1n, "erreur")
      ).to.be.revertedWithCustomError(registry, "AlreadyRevoked");
    });

    it("refuse un diplôme inexistant", async function () {
      await expect(
        registry.connect(issuer).revokeDiploma(99n, "x")
      ).to.be.revertedWithCustomError(registry, "DiplomaNotFound");
    });
  });

  describe("getDiploma", function () {
    it("retourne les données d'un diplôme", async function () {
      await registry.connect(issuer).issueDiploma(student.address, hash1, uri);
      const d = await registry.getDiploma(1n);
      expect(d.hash).to.equal(hash1);
      expect(d.student).to.equal(student.address);
      expect(d.metadataURI).to.equal(uri);
    });

    it("refuse un diplôme inexistant", async function () {
      await expect(registry.getDiploma(5n)).to.be.revertedWithCustomError(
        registry,
        "DiplomaNotFound"
      );
    });
  });

  describe("Rotation de clé (clé d'émetteur volée)", function () {
    it("l'admin retire le rôle et l'ancien émetteur ne peut plus émettre", async function () {
      await registry.connect(admin).revokeRole(ISSUER_ROLE, issuer.address);
      await expect(
        registry.connect(issuer).issueDiploma(student.address, hash1, uri)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });
  });
});