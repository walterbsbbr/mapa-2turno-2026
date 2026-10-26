import type { Municipio, Resultado } from "./types";

export interface Dados {
  municipios: Municipio[];
  resultados: Record<string, Resultado>; // por código IBGE
  nacional: Resultado | null;
}

const BANCO = "mapa-2turno-2026";
const CHAVE = "dados";

const abrir = () =>
  new Promise<IDBDatabase>((ok, erro) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("kv");
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });

/** Dados salvos neste navegador (IndexedDB); null se não houver ou se o navegador bloquear. */
export async function lerLocal(): Promise<Dados | null> {
  try {
    const db = await abrir();
    return await new Promise((ok) => {
      const req = db.transaction("kv").objectStore("kv").get(CHAVE);
      req.onsuccess = () => ok((req.result as Dados) ?? null);
      req.onerror = () => ok(null);
    });
  } catch {
    return null;
  }
}

export async function gravarLocal(d: Dados): Promise<void> {
  try {
    const db = await abrir();
    db.transaction("kv", "readwrite").objectStore("kv").put(d, CHAVE);
  } catch {
    /* sem cache local: segue só com o snapshot */
  }
}

/** Snapshot gerado no build (`npm run snapshot`) e servido junto com o site. */
export async function lerSnapshot(): Promise<Dados | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}dados-2turno-2026.json`);
    return r.ok ? ((await r.json()) as Dados) : null;
  } catch {
    return null;
  }
}

/** Junta duas fontes mantendo, por município, a leitura mais apurada. */
export function mesclar(a: Dados | null, b: Dados | null): Dados | null {
  if (!a || !b) return a ?? b;
  const resultados = { ...a.resultados };
  for (const [id, r] of Object.entries(b.resultados))
    if (!resultados[id] || r.secoesApuradas >= resultados[id].secoesApuradas) resultados[id] = r;
  const nacional =
    (b.nacional?.secoesApuradas ?? -1) >= (a.nacional?.secoesApuradas ?? -1) ? b.nacional : a.nacional;
  return { municipios: a.municipios.length ? a.municipios : b.municipios, resultados, nacional };
}
