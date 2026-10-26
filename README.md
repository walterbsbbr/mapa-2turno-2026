# Mapa do 2º turno 2026 por município

Votação para Presidente no 2º turno (25/10/2026) em cada um dos municípios brasileiros, com dados da API de
resultados do TSE (`resultados.tse.jus.br`, ambiente `oficial`, pleito 3221, eleição 6258) e malha do IBGE.

- Busca de cidade/estado (a cidade fica marcada no mapa, com os votos) e filtro por percentual mínimo de um candidato.
- Dados persistentes: `public/dados-2turno-2026.json` (snapshot) + IndexedDB. O TSE só é consultado para municípios
  ainda não 100% apurados, no máximo 30 req/s (o limite do TSE é 100 req/s por IP).

```
npm install
npm run dev
npm run snapshot   # atualiza o snapshot a partir da API do TSE (Node >= 22.18)
npm run malha      # baixa a malha municipal do IBGE
npm run build
```
