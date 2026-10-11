export type Cents = number;

export function toCents(amount: number): Cents {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100);
}

export function toDollars(cents: Cents): number {
  return cents / 100;
}

export function formatCurrency(cents: Cents): string {
  return `$${toDollars(cents).toFixed(2)}`;
}

export function distributeCents(totalCents: Cents, parts: number): Cents[] {
  if (parts <= 0) throw new Error('El número de partes debe ser mayor a 0');
  if (totalCents < 0) throw new Error('El total de centavos no puede ser negativo');

  const baseShare = Math.floor(totalCents / parts);
  const remainder = totalCents % parts;

  const result: Cents[] = new Array(parts).fill(baseShare);
  for (let i = 0; i < remainder; i++) {
    result[i] += 1;
  }
  return result;
}