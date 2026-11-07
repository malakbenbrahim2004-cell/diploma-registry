import { useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import type { Eip1193Provider } from "ethers";
import { ABI, CONTRACT_ADDRESS, RPC_URL } from "./contract";
import { sha256File } from "./hash";

const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;

async function basculerSurHardhat() {
  if (!eth) return;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7a69" }], // 31337 en hexadécimal
    });
  } catch {
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x7a69",
          chainName: "Hardhat Local",
          rpcUrls: ["http://127.0.0.1:8545"],
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        },
      ],
    });
  }
}

function Institution() {
  const [file, setFile] = useState<File | null>(null);
  const [student, setStudent] = useState("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  const [uri, setUri] = useState("");
  const [msg, setMsg] = useState("");

  async function emettre() {
    try {
      if (!eth) return setMsg("MetaMask n'est pas installé.");
      if (!file) return setMsg("Choisis d'abord le PDF du diplôme.");
      setMsg("Calcul du hash...");
      const hash = await sha256File(file);
      await basculerSurHardhat();
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, ABI, signer);
      setMsg("Confirme la transaction dans MetaMask...");
      const tx = await contract.issueDiploma(student, hash, uri);
      const receipt = await tx.wait();
      let id = "?";
      for (const log of receipt.logs) {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === "Issued") id = parsed.args.diplomaId.toString();
      }
      setMsg(`✅ Diplôme émis. ID = ${id}\nHash = ${hash}`);
    } catch (e) {
      setMsg("❌ " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <section>
      <h2>Espace institution</h2>
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <br />
      <input style={{ width: "100%" }} placeholder="Adresse de l'étudiant" value={student} onChange={(e) => setStudent(e.target.value)} />
      <br />
      <input style={{ width: "100%" }} placeholder="URI des métadonnées (optionnel)" value={uri} onChange={(e) => setUri(e.target.value)} />
      <br />
      <button onClick={emettre}>Émettre le diplôme</button>
      <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>
    </section>
  );
}

function Verificateur() {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");

  async function verifier() {
    try {
      if (!file) return setMsg("Choisis le PDF à vérifier.");
      const hash = await sha256File(file);
      const provider = new JsonRpcProvider(RPC_URL); // lecture seule, sans wallet
      const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);
      const id: bigint = await contract.getIdByHash(hash);
      if (id === 0n) return setMsg("❌ Invalide : ce PDF n'est pas enregistré.");
      const [valid, issuer, issuedAt, revoked] = await contract.verify(id, hash);
      if (revoked) setMsg(`⚠️ Diplôme révoqué (ID ${id})`);
      else if (valid)
        setMsg(`✅ Valide (ID ${id})\nÉmetteur : ${issuer}\nDate : ${new Date(Number(issuedAt) * 1000).toLocaleString()}`);
      else setMsg("❌ Invalide");
    } catch (e) {
      setMsg("❌ " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <section>
      <h2>Vérification publique</h2>
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <br />
      <button onClick={verifier}>Vérifier</button>
      <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>
    </section>
  );
}

export default function App() {
  return (
    <main style={{ maxWidth: 700, margin: "2rem auto", textAlign: "left", padding: "0 1rem" }}>
      <h1>DiplomaRegistry</h1>
      <Institution />
      <hr />
      <Verificateur />
    </main>
  );
}