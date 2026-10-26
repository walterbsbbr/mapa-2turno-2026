export interface Municipio {
  uf: string; // sigla minúscula, como na API (ex.: "sp")
  codTse: string; // "71072"
  codIbge: string; // "3550308"
  nome: string;
}

export interface Candidato {
  numero: string;
  nome: string;
  partido: string;
  votos: number;
  pct: number; // % dos votos válidos
  eleito: boolean;
}

export interface Resultado {
  secoesApuradas: number; // % das seções totalizadas
  eleitores: number;
  comparecimento: number;
  validos: number;
  brancos: number;
  nulos: number;
  candidatos: Candidato[];
}
