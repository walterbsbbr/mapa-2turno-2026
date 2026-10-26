// Baixa o resultado de todos os municípios da API do TSE (≤30 req/s) e grava public/dados-2turno-2026.json.
// O site carrega esse arquivo na hora e só reconsulta o TSE para municípios ainda não 100% apurados.
// Uso: npm run snapshot   (Node >= 22.18 executa o .ts direto)
import { writeFile } from "node:fs/promises";
import { carregarMunicipio, carregarMunicipios, carregarNacional } from "../src/tse.ts";

const municipios = await carregarMunicipios();
const resultados = {};
const fila = [...municipios];
let feitos = 0;

const trabalhador = async () => {
  for (let m = fila.shift(); m; m = fila.shift()) {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        const r = await carregarMunicipio(m);
        if (r) resultados[m.codIbge] = r;
        break;
      } catch (e) {
        if (tentativa === 2) console.warn(`falhou: ${m.nome}/${m.uf}`, e.message);
      }
    }
    if (++feitos % 500 === 0) console.log(`${feitos}/${municipios.length}`);
  }
};
await Promise.all(Array.from({ length: 30 }, trabalhador));

const nacional = await carregarNacional();
const incompletos = municipios.filter((m) => (resultados[m.codIbge]?.secoesApuradas ?? 0) < 100).length;
await writeFile(
  new URL("../public/dados-2turno-2026.json", import.meta.url),
  JSON.stringify({ municipios, resultados, nacional }),
);
console.log(`${Object.keys(resultados).length} municípios gravados; ${incompletos} não 100% apurados`);
