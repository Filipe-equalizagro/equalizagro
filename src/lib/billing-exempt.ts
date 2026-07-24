// Lista de emails da equipe/administração Equalizagro que não devem ser
// cobrados — acesso ilimitado ao Consultor.IA independente de assinatura.
// Fonte: lista de acesso interna fornecida pelo time (jul/2026).
export const EXEMPT_EMAILS = [
  // Equipe
  'henrique.fey@equalizagro.com',
  'joao.batista@equalizagro.com',
  'marcio.lima@equalizagro.com',
  'viviane@equalizagro.com',
  'taissa.fahl@equalizagro.com',
  'gabriellacordeiro.agro@gmail.com',
  'tiago.canale@equalizagro.com',
  'elian.zandona@equalizagro.com',
  'heitor.ortiz@equalizagro.com',
  'diego.luchini@equalizagro.com',
  'gilmarzanuzzi@gmail.com',
  'gilmar@equalizagro.com',
  'd.murilo@equalizagro.com',
  'andre@equalizagro.com',
  // Admin
  'adriel@equalizagro.com',
  'suporte@equalizagro.com',
  'ti@equalizagro.com',
  'filipe@equalizagro.com',
  'livino@equalizagro.com',
  // Suporte técnico externo
  'aaton.digital@gmail.com',
] as const;

const EXEMPT_SET = new Set(EXEMPT_EMAILS.map(e => e.toLowerCase()));

export function isExemptEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return EXEMPT_SET.has(email.trim().toLowerCase());
}
