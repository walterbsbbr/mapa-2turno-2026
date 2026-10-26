import type { Candidato, Municipio, Resultado } from "./types";

// Pleito 3221 (25/10/2026, 2º turno) · eleição 6258 (Eleição Ordinária Federal – Presidente)
const BASE = "https://resultados.tse.jus.br/oficial/ele2026/6258";
const ELEICAO = "e006258";
const CARGO = "c0001";

// O TSE permite 100 req/s por IP (acima disso, bloqueio de 10 min): ficamos bem abaixo.
const REQ_POR_SEGUNDO = 30;

const num = (s: string | undefined) => Number(s ?? 0) || 0;
const pct = (s: string | undefined) => Number((s ?? "0").replace(",", ".")) || 0;

let proximaSaida = 0;
async function aguardarVez() {
  const agora = performance.now();
  const saida = Math.max(agora, proximaSaida);
  proximaSaida = saida + 1000 / REQ_POR_SEGUNDO;
  if (saida > agora) await new Promise((r) => setTimeout(r, saida - agora));
}

async function getJson<T>(url: string): Promise<T | null> {
  await aguardarVez();
  const res = await fetch(url);
  if (res.status === 404) return null; // ainda sem totalização
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

interface ConfigMunicipios {
  abr: { cd: string; mu: { cd: string; cdi: string; nm: string }[] }[];
}

/** Lista de municípios (códigos TSE e IBGE), sem as seções do exterior (zz). */
export async function carregarMunicipios(): Promise<Municipio[]> {
  const cfg = await getJson<ConfigMunicipios>(`${BASE}/config/mun-${ELEICAO}-cm.json`);
  if (!cfg) throw new Error("Configuração de municípios indisponível");
  return cfg.abr
    .filter((a) => a.cd !== "zz")
    .flatMap((a) => a.mu.map((m) => ({ uf: a.cd, codTse: m.cd, codIbge: m.cdi, nome: m.nm })));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function interpretar(d: any): Resultado | null {
  const cargo = d?.carg?.[0];
  if (!cargo) return null;
  const candidatos: Candidato[] = [];
  for (const agr of cargo.agr ?? [])
    for (const par of agr.par ?? [])
      for (const c of par.cand ?? [])
        candidatos.push({
          numero: c.n,
          nome: c.nmu,
          partido: par.sg,
          votos: num(c.vap),
          pct: pct(c.pvapn ?? c.pvap),
          eleito: c.e === "s",
        });
  candidatos.sort((a, b) => Number(a.numero) - Number(b.numero));
  return {
    secoesApuradas: pct(d.s?.psan ?? d.s?.psa),
    eleitores: num(d.e?.te),
    comparecimento: num(d.e?.c),
    validos: num(d.v?.vv),
    brancos: num(d.v?.vb),
    nulos: num(d.v?.vn),
    candidatos,
  };
}

export async function carregarMunicipio(m: Municipio): Promise<Resultado | null> {
  return interpretar(await getJson(`${BASE}/dados/${m.uf}/${m.uf}${m.codTse}-${CARGO}-${ELEICAO}-u.json`));
}

/** Totalização nacional (inclui exterior). */
export async function carregarNacional(): Promise<Resultado | null> {
  return interpretar(await getJson(`${BASE}/dados/br/br-${CARGO}-${ELEICAO}-u.json`));
}
