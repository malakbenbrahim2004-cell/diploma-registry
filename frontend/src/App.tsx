import { useEffect, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import type { Eip1193Provider } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import { ABI, CONTRACT_ADDRESS, RPC_URL } from "./contract";
import { sha256File } from "./hash";

const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
const readContract = new Contract(CONTRACT_ADDRESS, ABI, new JsonRpcProvider(RPC_URL));

type Status = { kind: "ok" | "err" | "warn" | "info"; text: string } | null;

type DiplomaInfo = {
  id: bigint;
  hash: string;
  issuer: string;
  student: string;
  issuedAt: number;
  revoked: boolean;
  reason: string;
};

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function StatusBox({ s }: { s: Status }) {
  return s ? <div className={`status ${s.kind}`}>{s.text}</div> : null;
}

// Lecture de l'état du contrat (aucun eth_getLogs : pas de limite de blocs)
async function fetchDiplomas(max = 30): Promise<DiplomaInfo[]> {
  const count = Number(await readContract.diplomaCount());
  if (count === 0) return [];
  const first = Math.max(1, count - max + 1);
  const ids: bigint[] = [];
  for (let i = first; i <= count; i++) ids.push(BigInt(i));
  const results = await Promise.all(ids.map((id) => readContract.getDiploma(id)));
  return results.map((d, i) => ({
    id: ids[i],
    hash: d.hash as string,
    issuer: d.issuer as string,
    student: d.student as string,
    issuedAt: Number(d.issuedAt),
    revoked: d.revoked as boolean,
    reason: d.revokeReason as string,
  }));
}

async function basculerSurSepolia() {
  if (!eth) return;
  await eth.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }], // Sepolia
  });
}

async function getWriteContract() {
  if (!eth) throw new Error("MetaMask n'est pas installé.");
  await basculerSurSepolia();
  const signer = await new BrowserProvider(eth).getSigner();
  return new Contract(CONTRACT_ADDRESS, ABI, signer);
}

async function checkDiploma(id: bigint, hash: string): Promise<Status> {
  const [valid, issuer, issuedAt, revoked] = await readContract.verify(id, hash);
  if (revoked) return { kind: "warn", text: `⚠️ Diplôme révoqué (ID ${id})` };
  if (valid) {
    const date = new Date(Number(issuedAt) * 1000).toLocaleString();
    return { kind: "ok", text: `✅ Diplôme valide (ID ${id})\nÉmetteur : ${issuer}\nDate d'émission : ${date}` };
  }
  return { kind: "err", text: "❌ Invalide : le document ne correspond à aucun diplôme enregistré." };
}

function FileDrop({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  return (
    <label className={`dropzone ${file ? "has-file" : ""}`}>
      <span className="icon">{file ? "✅" : "📄"}</span>
      {file ? file.name : "Clique pour choisir le PDF du diplôme"}
      <input type="file" accept="application/pdf" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  );
}

/* ---------- Institution ---------- */
function Institution() {
  const [file, setFile] = useState<File | null>(null);
  const [student, setStudent] = useState("0x004bef56656C439D81E342915995a3235B5d902E");
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Status>(null);

  const [revId, setRevId] = useState("");
  const [reason, setReason] = useState("");
  const [revMsg, setRevMsg] = useState<Status>(null);

  async function emettre() {
    try {
      if (!file) return setMsg({ kind: "err", text: "Choisis d'abord le PDF du diplôme." });
      setBusy(true);
      setMsg({ kind: "info", text: "Calcul du hash SHA-256..." });
      const hash = await sha256File(file);
      const contract = await getWriteContract();
      setMsg({ kind: "info", text: "Confirme la transaction dans MetaMask..." });
      const tx = await contract.issueDiploma(student, hash, uri);
      const receipt = await tx.wait();
      let id = "?";
      for (const log of receipt.logs) {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === "Issued") id = parsed.args.diplomaId.toString();
      }
      setMsg({ kind: "ok", text: `✅ Diplôme émis. ID = ${id}\nHash = ${hash}` });
    } catch (e) {
      setMsg({ kind: "err", text: "❌ " + errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function revoquer() {
    try {
      if (!revId) return setRevMsg({ kind: "err", text: "Entre l'ID du diplôme." });
      if (!reason) return setRevMsg({ kind: "err", text: "Entre un motif (erreur, fraude, plagiat)." });
      setBusy(true);
      const contract = await getWriteContract();
      setRevMsg({ kind: "info", text: "Confirme la transaction dans MetaMask..." });
      const tx = await contract.revokeDiploma(BigInt(revId), reason);
      await tx.wait();
      setRevMsg({ kind: "warn", text: `⚠️ Diplôme ${revId} révoqué (motif : ${reason}).` });
    } catch (e) {
      setRevMsg({ kind: "err", text: "❌ " + errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>🏛️ Émettre un diplôme</h2>
        <p className="sub">Le PDF reste sur ton ordinateur : seule son empreinte SHA-256 est enregistrée sur la blockchain.</p>
        <FileDrop file={file} onChange={setFile} />
        <label>Adresse du wallet de l'étudiant</label>
        <input type="text" value={student} onChange={(e) => setStudent(e.target.value)} />
        <label>URI des métadonnées (optionnel)</label>
        <input type="text" placeholder="ipfs://..." value={uri} onChange={(e) => setUri(e.target.value)} />
        <button className="btn" onClick={emettre} disabled={busy}>Émettre le diplôme</button>
        <StatusBox s={msg} />
      </div>

      <div className="card">
        <h2>🚫 Révoquer un diplôme</h2>
        <p className="sub">Réservé à l'émetteur d'origine ou à l'administrateur.</p>
        <label>ID du diplôme</label>
        <input type="number" min="1" value={revId} onChange={(e) => setRevId(e.target.value)} />
        <label>Motif</label>
        <input type="text" placeholder="erreur de saisie, fraude, plagiat..." value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn danger" onClick={revoquer} disabled={busy}>Révoquer</button>
        <StatusBox s={revMsg} />
      </div>
    </>
  );
}

/* ---------- Étudiant ---------- */
function Etudiant() {
  const [account, setAccount] = useState("");
  const [list, setList] = useState<DiplomaInfo[]>([]);
  const [selected, setSelected] = useState<DiplomaInfo | null>(null);
  const [msg, setMsg] = useState<Status>(null);

  async function connecter() {
    try {
      if (!eth) return setMsg({ kind: "err", text: "MetaMask n'est pas installé." });
      await basculerSurSepolia();
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(accounts[0]);
      setMsg({ kind: "info", text: "Chargement de tes diplômes..." });
      const all = await fetchDiplomas(200);
      const mine = all.filter((d) => d.student.toLowerCase() === accounts[0].toLowerCase());
      setList(mine);
      setSelected(null);
      setMsg(mine.length ? null : { kind: "info", text: "Aucun diplôme trouvé pour ce compte." });
    } catch (e) {
      setMsg({ kind: "err", text: "❌ " + errMsg(e) });
    }
  }

  const link = selected ? `${window.location.origin}/?id=${selected.id}&hash=${selected.hash}` : "";

  return (
    <div className="card">
      <h2>🎓 Mes diplômes</h2>
      <p className="sub">Connecte ton wallet pour voir tes diplômes et générer un QR code de vérification.</p>
      <button className="btn" onClick={connecter}>{account ? "Actualiser" : "Connecter mon wallet"}</button>
      {account && <p className="sub" style={{ marginTop: ".8rem", wordBreak: "break-all" }}>Compte : {account}</p>}
      <StatusBox s={msg} />

      {list.map((d) => (
        <div className="item" key={d.id.toString()}>
          <div>
            <div className="title">
              Diplôme n°{d.id.toString()}
              <span className={`badge ${d.revoked ? "err" : "ok"}`}>{d.revoked ? "Révoqué" : "Valide"}</span>
            </div>
            <div className="meta">Émis le {new Date(d.issuedAt * 1000).toLocaleDateString()}</div>
            <div className="meta">{d.hash}</div>
          </div>
          <button className="btn small" onClick={() => setSelected(d)}>QR code</button>
        </div>
      ))}

      {selected && (
        <div className="qrbox">
          <QRCodeSVG value={link} size={200} />
          <div className="link">{link}</div>
        </div>
      )}
    </div>
  );
}

/* ---------- Vérificateur ---------- */
function Verificateur({ initial }: { initial: { id: string; hash: string } | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<Status>(null);

  useEffect(() => {
    if (!initial) return;
    checkDiploma(BigInt(initial.id), initial.hash)
      .then(setMsg)
      .catch((e) => setMsg({ kind: "err", text: "❌ " + errMsg(e) }));
  }, [initial]);

  async function verifier() {
    try {
      if (!file) return setMsg({ kind: "err", text: "Choisis le PDF à vérifier." });
      const hash = await sha256File(file);
      const id: bigint = await readContract.getIdByHash(hash);
      if (id === 0n) return setMsg({ kind: "err", text: "❌ Invalide : ce PDF n'est pas enregistré." });
      setMsg(await checkDiploma(id, hash));
    } catch (e) {
      setMsg({ kind: "err", text: "❌ " + errMsg(e) });
    }
  }

  return (
    <div className="card">
      <h2>🔍 Vérifier un diplôme</h2>
      <p className="sub">Aucun compte ni wallet nécessaire. Charge le PDF reçu, ou scanne le QR code de l'étudiant.</p>
      <FileDrop file={file} onChange={setFile} />
      <button className="btn" onClick={verifier}>Vérifier</button>
      <StatusBox s={msg} />
    </div>
  );
}

/* ---------- Historique ---------- */
function Historique() {
  const [rows, setRows] = useState<DiplomaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<Status>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await fetchDiplomas(30);
        setRows(all.reverse());
      } catch (e) {
        setMsg({ kind: "err", text: "❌ " + errMsg(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="card">
      <h2>📜 Historique des émissions</h2>
      <p className="sub">Lu depuis le registre on-chain. Les événements Issued / Revoked sont consultables sur Etherscan.</p>
      <StatusBox s={msg} />
      {loading && <div className="empty">Chargement...</div>}
      {!loading && !msg && rows.length === 0 && <div className="empty">Aucune émission pour le moment.</div>}
      {rows.map((r) => (
        <div className="item" key={r.id.toString()}>
          <div>
            <div className="title">
              Diplôme n°{r.id.toString()}
              <span className={`badge ${r.revoked ? "err" : "ok"}`}>{r.revoked ? "Révoqué" : "Valide"}</span>
            </div>
            <div className="meta">Émis le {new Date(r.issuedAt * 1000).toLocaleString()}</div>
            <div className="meta">Émetteur : {r.issuer}</div>
            <div className="meta">Étudiant : {r.student}</div>
            {r.revoked && <div className="meta">Motif : {r.reason}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- App ---------- */
type Tab = "institution" | "etudiant" | "verifier" | "historique";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const link = params.get("id") && params.get("hash") ? { id: params.get("id")!, hash: params.get("hash")! } : null;
  const [tab, setTab] = useState<Tab>(link ? "verifier" : "institution");

  const tabs: [Tab, string][] = [
    ["institution", "🏛️ Institution"],
    ["etudiant", "🎓 Étudiant"],
    ["verifier", "🔍 Vérifier"],
    ["historique", "📜 Historique"],
  ];

  return (
    <>
      <header className="hero">
        <h1>DiplomaRegistry</h1>
        <p>Diplômes infalsifiables, vérifiables en quelques secondes grâce à la blockchain</p>
      </header>
      <div className="container">
        <nav className="tabs">
          {tabs.map(([key, label]) => (
            <button key={key} className={`tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>
        {tab === "institution" && <Institution />}
        {tab === "etudiant" && <Etudiant />}
        {tab === "verifier" && <Verificateur initial={link} />}
        {tab === "historique" && <Historique />}
      </div>
    </>
  );
}