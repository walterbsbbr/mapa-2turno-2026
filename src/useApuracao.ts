import { useEffect, useState } from "react";
import { gravarLocal, lerLocal, lerSnapshot, mesclar, type Dados } from "./cache";
import { carregarMunicipio, carregarMunicipios, carregarNacional } from "./tse";
import type { Municipio, Resultado } from "./types";

const INTERVALO_ATUALIZACAO_MS = 60_000;
const CONCORRENCIA = 30;

export interface Apuracao {
  municipios: Municipio[];
  resultados: Map<string, Resultado>; // por código IBGE
  nacional: Resultado | null;
  carregados: number;
  total: number;
  atualizadoEm: Date | null;
  concluida: boolean;
  erro: string | null;
}

const vazio: Apuracao = {
  municipios: [],
  resultados: new Map(),
  nacional: null,
  carregados: 0,
  total: 0,
  atualizadoEm: null,
  concluida: false,
  erro: null,
};

const incompleto = (res: Map<string, Resultado>, m: Municipio) => (res.get(m.codIbge)?.secoesApuradas ?? 0) < 100;

/**
 * Dados persistentes: snapshot do build + IndexedDB do navegador entram primeiro; a API do TSE só é
 * consultada para municípios que ainda não chegaram a 100% apurado (e o resultado volta para o cache).
 */
export function useApuracao(): Apuracao {
  const [estado, setEstado] = useState<Apuracao>(vazio);

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resultados = new Map<string, Resultado>();
    let municipios: Municipio[] = [];
    let nacional: Resultado | null = null;

    const publicar = (parcial: Partial<Apuracao> = {}) =>
      ativo && setEstado((e) => ({ ...e, resultados: new Map(resultados), nacional, ...parcial }));
    const salvar = () =>
      gravarLocal({ municipios, resultados: Object.fromEntries(resultados), nacional } satisfies Dados);

    async function ciclo(alvo: Municipio[]) {
      let ultimoRender = 0;
      const fila = [...alvo];
      const trabalhador = async () => {
        for (let m = fila.shift(); m && ativo; m = fila.shift()) {
          try {
            const r = await carregarMunicipio(m);
            if (r) resultados.set(m.codIbge, r);
          } catch {
            /* mantém o último valor; tenta de novo no próximo ciclo */
          }
          if (performance.now() - ultimoRender > 500) {
            ultimoRender = performance.now();
            publicar({ carregados: resultados.size });
          }
        }
      };
      await Promise.all(Array.from({ length: CONCORRENCIA }, trabalhador));
      if (!ativo) return;

      nacional = (await carregarNacional().catch(() => null)) ?? nacional;
      const pendentes = municipios.filter((m) => incompleto(resultados, m));
      const concluida = pendentes.length === 0;
      publicar({ carregados: resultados.size, atualizadoEm: new Date(), concluida });
      salvar();
      if (!concluida) timer = setTimeout(() => ciclo(pendentes), INTERVALO_ATUALIZACAO_MS);
    }

    (async () => {
      try {
        const guardado = mesclar(await lerSnapshot(), await lerLocal());
        if (guardado) {
          municipios = guardado.municipios;
          nacional = guardado.nacional;
          for (const [id, r] of Object.entries(guardado.resultados)) resultados.set(id, r);
        }
        if (!municipios.length) municipios = await carregarMunicipios();

        const pendentes = municipios.filter((m) => incompleto(resultados, m));
        const concluida = pendentes.length === 0;
        publicar({ municipios, total: municipios.length, carregados: resultados.size, concluida });
        if (!concluida) await ciclo(pendentes);
        else salvar();
      } catch (e) {
        publicar({ erro: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, []);

  return estado;
}
