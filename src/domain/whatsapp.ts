import type { PersonResult } from '../app/types';
import { formatCurrency } from './money';

export function createWhatsAppSummary(results: PersonResult[]): string {
  const grandTotalCents = results.reduce((sum, r) => sum + r.totalCents, 0);

  const lines: string[] = ['🧾 *RESUMEN DE LA CUENTA*', '--------------------------------'];

  for (const person of results) {
    lines.push(`👤 *${person.personName}*: ${formatCurrency(person.totalCents)}`);

    if (person.items.length > 0) {
      for (const item of person.items) {
        const shareTag = item.sharedWith > 1 ? ` (1/${item.sharedWith})` : '';
        lines.push(`   • ${item.name}${shareTag}: ${formatCurrency(item.amountCents)}`);
      }
    }

    lines.push(
      `   _Subtotal: ${formatCurrency(person.subtotalCents)} | Propina: ${formatCurrency(person.tipCents)}_`
    );
    lines.push('');
  }

  lines.push('--------------------------------');
  lines.push(`💰 *TOTAL GENERAL: ${formatCurrency(grandTotalCents)}*`);

  return lines.join('\n');
}

export function shareWhatsApp(results: PersonResult[]): void {
  const text = createWhatsAppSummary(results);
  window.location.href = `whatsapp://send?text=${encodeURIComponent(text)}`;
}