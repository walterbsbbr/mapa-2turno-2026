import type { Candidato } from "./types";

const PALETA_PARTIDO: Record<string, string> = { PT: "#c8283a", PL: "#1f64b4" };
const FALLBACK = ["#c8283a", "#1f64b4", "#2a9d6f", "#d98a1c"];
const NEUTRO = [244, 238, 230];

export function corBase(c: Candidato, indice: number): string {
  return PALETA_PARTIDO[c.partido] ?? FALLBACK[indice % FALLBACK.length];
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Cor do vencedor; quanto maior a margem sobre 50%, mais saturada. */
export function corMunicipio(hex: string, pctVencedor: number): string {
  return corIntensidade(hex, (pctVencedor - 50) / 30);
}

/** t em [0,1]: 0 = quase neutro, 1 = cor cheia. */
export function corIntensidade(hex: string, t: number): string {
  const f = 0.3 + 0.7 * Math.min(Math.max(t, 0), 1);
  const [r, g, b] = rgb(hex).map((v, i) => Math.round(NEUTRO[i] + (v - NEUTRO[i]) * f));
  return `rgb(${r},${g},${b})`;
}

export const SEM_DADOS = "#d9dde2";
