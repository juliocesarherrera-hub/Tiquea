import { type Cents, toCents, distributeCents } from './money';
import type { Person, ReceiptItem, Tip, PersonResult } from '../app/types';

export function calculateQuickBill(
  totalAmount: number,
  peopleCount: number,
  tipPercentage: number
): PersonResult[] {
  if (peopleCount <= 0) throw new Error('Debe haber al menos 1 persona.');
  if (totalAmount < 0) throw new Error('El total no puede ser negativo.');

  const totalCents = toCents(totalAmount);
  const subtotalShares = distributeCents(totalCents, peopleCount);

  const totalTipCents = Math.round(totalCents * (tipPercentage / 100));
  const tipShares = distributeCents(totalTipCents, peopleCount);

  return subtotalShares.map((subtotalCents, index) => ({
    personId: `quick_${index + 1}`,
    personName: `Persona ${index + 1}`,
    items: [],
    subtotalCents,
    tipCents: tipShares[index],
    totalCents: subtotalCents + tipShares[index],
  }));
}

export function calculateDetailedBill(
  people: Person[],
  items: ReceiptItem[],
  tip: Tip
): PersonResult[] {
  if (people.length === 0) throw new Error('Agrega al menos una persona.');

  const personSubtotals = new Map<string, Cents>();
  const personItemsMap = new Map<string, Array<{ name: string; amountCents: Cents; sharedWith: number }>>();

  for (const person of people) {
    personSubtotals.set(person.id, 0);
    personItemsMap.set(person.id, []);
  }

  for (const item of items) {
    if (item.assignedTo.length === 0) continue;

    const itemCents = toCents(item.price);
    const shares = distributeCents(itemCents, item.assignedTo.length);

    item.assignedTo.forEach((personId, idx) => {
      if (personSubtotals.has(personId)) {
        const shareCents = shares[idx];
        const currentSubtotal = personSubtotals.get(personId) || 0;
        personSubtotals.set(personId, currentSubtotal + shareCents);

        const list = personItemsMap.get(personId) || [];
        list.push({
          name: item.name,
          amountCents: shareCents,
          sharedWith: item.assignedTo.length,
        });
        personItemsMap.set(personId, list);
      }
    });
  }

  const grandSubtotalCents = Array.from(personSubtotals.values()).reduce((a, b) => a + b, 0);

  let totalTipCents: Cents = 0;
  if (tip.type === 'percentage') {
    totalTipCents = Math.round(grandSubtotalCents * (tip.value / 100));
  } else {
    totalTipCents = toCents(tip.value);
  }

  const personTipMap = new Map<string, Cents>();
  if (grandSubtotalCents > 0) {
    let assignedTipSum = 0;
    const peopleList = Array.from(personSubtotals.keys());

    peopleList.forEach((pid) => {
      const pSubtotal = personSubtotals.get(pid) || 0;
      const pTip = Math.floor((pSubtotal / grandSubtotalCents) * totalTipCents);
      personTipMap.set(pid, pTip);
      assignedTipSum += pTip;
    });

    const tipRemainder = totalTipCents - assignedTipSum;
    for (let i = 0; i < tipRemainder; i++) {
      const pid = peopleList[i % peopleList.length];
      personTipMap.set(pid, (personTipMap.get(pid) || 0) + 1);
    }
  } else {
    const tipShares = distributeCents(totalTipCents, people.length);
    people.forEach((p, idx) => personTipMap.set(p.id, tipShares[idx]));
  }

  return people.map((person) => {
    const subtotalCents = personSubtotals.get(person.id) || 0;
    const tipCents = personTipMap.get(person.id) || 0;

    return {
      personId: person.id,
      personName: person.name,
      items: personItemsMap.get(person.id) || [],
      subtotalCents,
      tipCents,
      totalCents: subtotalCents + tipCents,
    };
  });
}