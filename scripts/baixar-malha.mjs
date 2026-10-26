// Baixa a malha municipal do IBGE e grava com coordenadas arredondadas (menor e igualmente nítida no zoom do mapa).
import { writeFile } from "node:fs/promises";

const MALHA_URL =
  "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=minima";
const casas = 10 ** 3;
const arred = (c) => (Array.isArray(c[0]) ? c.map(arred) : c.map((n) => Math.round(n * casas) / casas));

// d3-geo (esférico) exige anel externo horário e furos anti-horários; o IBGE entrega o contrário.
const area = (r) => r.reduce((a, [x, y], i) => a + (r[(i + 1) % r.length][0] - x) * (r[(i + 1) % r.length][1] + y), 0);
const orienta = (poly) => poly.map((r, i) => ((area(r) < 0) === (i === 0) ? r.reverse() : r));
const reorienta = (g) => {
  g.coordinates = g.type === "Polygon" ? orienta(g.coordinates) : g.coordinates.map(orienta);
};

const geo = await (await fetch(MALHA_URL)).json();
for (const f of geo.features) {
  f.geometry.coordinates = arred(f.geometry.coordinates);
  reorienta(f.geometry);
}
await writeFile(new URL("../public/malha-municipios.json", import.meta.url), JSON.stringify(geo));
console.log(`${geo.features.length} municípios gravados`);
