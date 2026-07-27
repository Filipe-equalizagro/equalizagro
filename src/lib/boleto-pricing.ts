// Boleto só está disponível para o plano Anual — é um PAGAMENTO ÚNICO pelo
// valor cheio do ano (não recorrência mensal), já que a Stripe não consegue
// re-cobrar um boleto automaticamente como faz com cartão. O Mensal é
// cartão apenas.
export const BOLETO_PRICES: Record<string, number> = {
  Anual: 1790.0, // valor integral de 12 meses de acesso, cobrado uma única vez
};

export function getBoletoPrice(planName: string): number | undefined {
  return BOLETO_PRICES[planName];
}
