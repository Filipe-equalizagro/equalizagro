// Validadores compartilhados entre client e server (sem depender de
// next/server, que quebraria em componentes de cliente).

// Valida CPF pelo algoritmo oficial (dois dígitos verificadores), não só o
// formato — bloqueia sequências óbvias como "00000000000" ou "11111111111"
// que passariam por uma regex simples mas nunca são CPFs reais.
export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (base: string): number => {
    let sum = 0;
    const weight = base.length + 1;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * (weight - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcCheckDigit(digits.slice(0, 9));
  const d2 = calcCheckDigit(digits.slice(0, 10));
  return d1 === parseInt(digits[9], 10) && d2 === parseInt(digits[10], 10);
}

export function formatCPF(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
