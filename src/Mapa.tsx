import { useEffect, useMemo, useRef } from "react";
import { geoMercator, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { corBase, corIntensidade, corMunicipio, SEM_DADOS } from "./cores";
import type { Candidato, Municipio, Resultado } from "./types";

export type Malha = FeatureCollection<Geometry, { codarea: string }>;

const L = 900;
const A = 900;

interface Props {
  malha: Malha;
  municipios: Municipio[];
  resultados: Map<string, Resultado>;
  candidatos: Candidato[];
  uf: string; // "" = Brasil
  selecionado: string; // código IBGE da cidade marcada ("" = nenhuma)
  filtro: { numero: string; min: number } | null; // só colore quem tem >= min% para o candidato
  onHover: (codIbge: string | null, x: number, y: number) => void;
}

export default function Mapa({ malha, municipios, resultados, candidatos, uf, selecionado, filtro, onHover }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const marcaRef = useRef<SVGCircleElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown>>();

  const { caminhos, caminho } = useMemo(() => {
    const proj = geoMercator().fitSize([L, A], malha);
    const caminho = geoPath(proj);
    const caminhos = malha.features.map((f: Feature<Geometry, { codarea: string }>) => ({
      id: f.properties.codarea,
      d: caminho(f) ?? "",
    }));
    return { caminhos, caminho };
  }, [malha]);

  const ufDe = useMemo(() => new Map(municipios.map((m) => [m.codIbge, m.uf])), [municipios]);

  useEffect(() => {
    const svg = select(svgRef.current!);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 60])
      .on("zoom", (e) => {
        select(gRef.current!).attr("transform", e.transform.toString());
        select(marcaRef.current!).attr("r", 9 / e.transform.k).attr("stroke-width", 2.5 / e.transform.k);
      });
    zoomRef.current = z;
    svg.call(z);
  }, []);

  useEffect(() => {
    const svg = select(svgRef.current!);
    const z = zoomRef.current;
    if (!z) return;
    let alvo = zoomIdentity;
    const feats = selecionado
      ? malha.features.filter((f) => f.properties.codarea === selecionado)
      : uf
        ? malha.features.filter((f) => ufDe.get(f.properties.codarea) === uf)
        : [];
    {
      if (feats.length) {
        const [[x0, y0], [x1, y1]] = caminho.bounds({ type: "FeatureCollection", features: feats });
        const k = Math.min(selecionado ? 25 : 60, 0.9 / Math.max((x1 - x0) / L, (y1 - y0) / A));
        alvo = zoomIdentity.translate(L / 2 - (k * (x0 + x1)) / 2, A / 2 - (k * (y0 + y1)) / 2).scale(k);
      }
    }
    svg.transition().duration(650).call(z.transform, alvo);
  }, [uf, selecionado, malha, ufDe, caminho]);

  const cores = useMemo(() => new Map(candidatos.map((c, i) => [c.numero, corBase(c, i)])), [candidatos]);

  const centro = useMemo(() => {
    const f = selecionado ? malha.features.find((x) => x.properties.codarea === selecionado) : undefined;
    return f ? caminho.centroid(f) : null;
  }, [selecionado, malha, caminho]);

  return (
    <svg
      ref={svgRef}
      className="mapa"
      viewBox={`0 0 ${L} ${A}`}
      onPointerMove={(e) => {
        const id = (e.target as SVGElement).dataset?.id;
        onHover(id ?? null, e.clientX, e.clientY);
      }}
      onPointerLeave={() => onHover(null, 0, 0)}
    >
      <g ref={gRef}>
        {caminhos.map(({ id, d }) => {
          const r = resultados.get(id);
          const lider = r?.candidatos.reduce((a, b) => (b.votos > a.votos ? b : a));
          let fill = lider && lider.votos > 0 ? corMunicipio(cores.get(lider.numero) ?? "#888888", lider.pct) : SEM_DADOS;
          let fora = !selecionado && uf && ufDe.get(id) !== uf;
          if (filtro) {
            const c = r?.candidatos.find((x) => x.numero === filtro.numero);
            if (c && c.pct >= filtro.min)
              fill = corIntensidade(cores.get(c.numero) ?? "#888888", (c.pct - filtro.min) / Math.max(100 - filtro.min, 1));
            else {
              fill = SEM_DADOS;
              fora = true;
            }
          }
          return <path key={id} d={d} data-id={id} fill={fill} opacity={fora ? 0.3 : 1} />;
        })}
        {selecionado && (
          <path className="destaque" d={caminhos.find((c) => c.id === selecionado)?.d} fill="none" pointerEvents="none" />
        )}
        <circle ref={marcaRef} className="marca" cx={centro?.[0]} cy={centro?.[1]} r={9} display={centro ? undefined : "none"} pointerEvents="none" />
      </g>
    </svg>
  );
}
