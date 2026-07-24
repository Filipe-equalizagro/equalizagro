// Boleto tem preço próprio, diferente do cartão — e para o plano Anual o
// boleto é um PAGAMENTO ÚNICO pelo valor cheio do ano (não recorrência
// mensal), já que a Stripe não consegue re-cobrar um boleto automaticamente
// como faz com cartão.
export const BOLETO_PRICES: Record<string, number> = {
  Mensal: 210.0,
  Anual: 1790.0, // valor integral de 12 meses de acesso, cobrado uma única vez
};

export function getBoletoPrice(planName: string): number | undefined {
  return BOLETO_PRICES[planName];
}
