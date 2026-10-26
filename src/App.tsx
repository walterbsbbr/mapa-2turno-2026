import { useEffect, useMemo, useState } from "react";
import Mapa, { type Malha } from "./Mapa";
import { corBase, corMunicipio } from "./cores";
import { useApuracao } from "./useApuracao";
import type { Candidato, Municipio, Resultado } from "./types";

const UFS = "AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" ");
const nf = new Intl.NumberFormat("pt-BR");
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const titulo = (t: string) => t.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).replace(/ (D[aeo]s?|E) /g, (m) => m.toLowerCase());
const pf = (n: number) => `${n.toFixed(2).replace(".", ",")}%`;

function Placar({ candidatos, cores }: { candidatos: Candidato[]; cores: string[] }) {
  return (
    <div className="placar">
      {candidatos.map((c, i) => (
        <div key={c.numero} className="cand" style={{ borderColor: cores[i] }}>
          <b>{c.nome}</b> <small>{c.partido}</small>
          <div className="pct">{pf(c.pct)}</div>
          <small>{nf.format(c.votos)} votos{c.eleito ? " · eleito" : ""}</small>
        </div>
      ))}
    </div>
  );
}

type Sugestao = { tipo: "uf"; uf: string } | { tipo: "cidade"; m: Municipio };

function Busca({ municipios, onUf, onCidade }: { municipios: Municipio[]; onUf: (uf: string) => void; onCidade: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const indice = useMemo(() => municipios.map((m) => ({ m, chave: semAcento(m.nome) })), [municipios]);

  const sugestoes = useMemo<Sugestao[]>(() => {
    const t = semAcento(q.trim());
    if (!t) return [];
    const ufs: Sugestao[] = UFS.filter((u) => u.toLowerCase() === t).map((u) => ({ tipo: "uf", uf: u.toLowerCase() }));
    const exatos = indice.filter((x) => x.chave === t);
    const iniciam = indice.filter((x) => x.chave !== t && x.chave.startsWith(t));
    const contem = indice.filter((x) => !x.chave.startsWith(t) && x.chave.includes(t));
    return [...ufs, ...[...exatos, ...iniciam, ...contem].slice(0, 8).map((x): Sugestao => ({ tipo: "cidade", m: x.m }))];
  }, [q, indice]);

  const escolher = (s: Sugestao) => {
    if (s.tipo === "uf") onUf(s.uf);
    else onCidade(s.m.codIbge);
    setQ(s.tipo === "uf" ? s.uf.toUpperCase() : `${titulo(s.m.nome)} – ${s.m.uf.toUpperCase()}`);
    setAberto(false);
  };

  return (
    <div className="busca">
      <input
        type="search"
        placeholder="Buscar cidade ou estado (ex.: Campinas, SP)"
        value={q}
        onChange={(e) => { setQ(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => e.key === "Enter" && sugestoes[0] && escolher(sugestoes[0])}
      />
      {aberto && sugestoes.length > 0 && (
        <ul>
          {sugestoes.map((s) => (
            <li key={s.tipo === "uf" ? s.uf : s.m.codIbge} onMouseDown={() => escolher(s)}>
              {s.tipo === "uf" ? `Estado ${s.uf.toUpperCase()}` : `${titulo(s.m.nome)} – ${s.m.uf.toUpperCase()}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CartaoCidade({ m, r, cores, onFechar }: { m: Municipio; r?: Resultado; cores: string[]; onFechar: () => void }) {
  return (
    <div className="cartao">
      <button onClick={onFechar} aria-label="Fechar">×</button>
      <b>{titulo(m.nome)} – {m.uf.toUpperCase()}</b>
      {r ? (
        <>
          {r.candidatos.map((c, i) => (
            <div key={c.numero} className="linha" style={{ borderColor: cores[i] }}>
              <span>{c.nome}</span>
              <span><b>{pf(c.pct)}</b> · {nf.format(c.votos)} votos</span>
            </div>
          ))}
          <small>
            {pf(r.secoesApuradas)} apurado · válidos {nf.format(r.validos)} · brancos {nf.format(r.brancos)} · nulos {nf.format(r.nulos)}
          </small>
        </>
      ) : (
        <small>Sem dados ainda</small>
      )}
    </div>
  );
}

export default function App() {
  const ap = useApuracao();
  const [malha, setMalha] = useState<Malha | null>(null);
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [filtroNumero, setFiltroNumero] = useState("");
  const [filtroMin, setFiltroMin] = useState("");
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}malha-municipios.json`).then((r) => r.json()).then(setMalha);
  }, []);

  const candidatos = useMemo(
    () => ap.nacional?.candidatos ?? [...ap.resultados.values()][0]?.candidatos ?? [],
    [ap.nacional, ap.resultados],
  );
  const cores = candidatos.map(corBase);
  const nomes = useMemo(() => new Map(ap.municipios.map((m) => [m.codIbge, m])), [ap.municipios]);
  const minimo = filtroMin === "" ? NaN : Number(filtroMin.replace(",", "."));
  const numeroFiltro = filtroNumero || candidatos[0]?.numero || "";
  const filtro = Number.isFinite(minimo) && numeroFiltro ? { numero: numeroFiltro, min: minimo } : null;
  const qtdFiltro = useMemo(() => {
    if (!filtro) return 0;
    let n = 0;
    for (const r of ap.resultados.values())
      if ((r.candidatos.find((c) => c.numero === filtro.numero)?.pct ?? -1) >= filtro.min) n++;
    return n;
  }, [filtro, ap.resultados]);
  const mun = hover ? nomes.get(hover.id) : undefined;
  const res = hover ? ap.resultados.get(hover.id) : undefined;

  return (
    <div className="app">
      <header>
        <h1>2º turno 2026 · Presidente · votação por município</h1>
        <p className="status">
          {ap.erro
            ? `Erro: ${ap.erro}`
            : ap.concluida
              ? "Apuração concluída"
              : `Carregando municípios… ${nf.format(ap.carregados)} / ${nf.format(ap.total)}${
                  ap.atualizadoEm ? ` · atualiza a cada minuto (última ${ap.atualizadoEm.toLocaleTimeString("pt-BR")})` : ""
                }`}
          {ap.nacional && ` · ${pf(ap.nacional.secoesApuradas)} das seções`}
        </p>
        {ap.nacional && <Placar candidatos={ap.nacional.candidatos} cores={cores} />}
        <div className="filtros">
        <Busca
          municipios={ap.municipios}
          onUf={(u) => { setCidade(""); setUf(u); }}
          onCidade={(id) => { setUf(""); setCidade(id); }}
        />
        <label>
          Estado{" "}
          <select value={uf} onChange={(e) => { setCidade(""); setUf(e.target.value); }}>
            <option value="">Brasil</option>
            {UFS.map((u) => (
              <option key={u} value={u.toLowerCase()}>{u}</option>
            ))}
          </select>
        </label>
        <label className="filtro-pct">
          Mostrar só quem deu{" "}
          <select value={numeroFiltro} onChange={(e) => setFiltroNumero(e.target.value)}>
            {candidatos.map((c) => <option key={c.numero} value={c.numero}>{c.nome}</option>)}
          </select>{" "}
          ≥{" "}
          <input type="number" min={0} max={100} step={0.5} placeholder="%" value={filtroMin} onChange={(e) => setFiltroMin(e.target.value)} />
          %
          {filtro && (
            <>
              {" "}<small>{nf.format(qtdFiltro)} municípios</small>{" "}
              <button onClick={() => setFiltroMin("")}>limpar</button>
            </>
          )}
        </label>
        </div>
        {cidade && nomes.get(cidade) && (
          <CartaoCidade m={nomes.get(cidade)!} r={ap.resultados.get(cidade)} cores={cores} onFechar={() => setCidade("")} />
        )}
        <div className="legenda">
          {candidatos.map((c, i) => (
            <span key={c.numero} className="escala">
              {c.nome}
              {[50, 60, 70, 80].map((p) => (
                <i key={p} style={{ background: corMunicipio(cores[i], p) }} title={`${p}%`} />
              ))}
            </span>
          ))}
          <small>50% → 80%+ dos votos válidos</small>
        </div>
      </header>

      {malha && (
        <Mapa
          malha={malha}
          municipios={ap.municipios}
          resultados={ap.resultados}
          candidatos={candidatos}
          uf={uf}
          selecionado={cidade}
          filtro={filtro}
          onHover={(id, x, y) => setHover(id ? { id, x, y } : null)}
        />
      )}

      {hover && mun && (
        <div className="tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <b>{titulo(mun.nome)} – {mun.uf.toUpperCase()}</b>
          {res ? (
            <>
              {res.candidatos.map((c) => (
                <div key={c.numero}>{c.nome}: {pf(c.pct)} <small>({nf.format(c.votos)})</small></div>
              ))}
              <small>{pf(res.secoesApuradas)} apurado · {nf.format(res.validos)} válidos</small>
            </>
          ) : (
            <div>Sem dados ainda</div>
          )}
        </div>
      )}
    </div>
  );
}
