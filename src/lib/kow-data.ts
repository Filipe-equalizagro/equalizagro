// lib/kow-data.ts
// Toda a lógica de negócio do Consultor Kow (base de produtos, faixas de
// Kow, IA) agora vive no workflow n8n — nosso backend é só um proxy
// (ver src/app/api/kow/perguntar/route.ts). Este arquivo guarda apenas a
// salvaguarda de texto que vale nos dois lados.

// A palavra "recomendação" nunca deve aparecer — a Tendência de adjuvante
// não é uma recomendação agronômica, é só um indicativo técnico.
export function semRecomendacao(t: string): string {
  return String(t)
    .replace(/recomenda[çc][õo]es/gi, 'tendências de adjuvante')
    .replace(/recomenda[çc][ãa]o/gi, 'tendência de adjuvante')
    .replace(/recomendad([oa]s?)/gi, 'indicad$1')
    .replace(/recomend(amos|o|a|ar|ei|e)/gi, 'indica');
}
