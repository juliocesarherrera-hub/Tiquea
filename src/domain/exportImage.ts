import type { PersonResult } from '../app/types';
import { formatCurrency } from './money';

export function downloadSummaryAsImage(results: PersonResult[]) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = 600;
  const padding = 40;
  const headerHeight = 120;
  const itemHeight = 32;
  
  let totalCardsHeight = 0;
  results.forEach((p) => {
    totalCardsHeight += 60 + Math.max(1, p.items.length) * itemHeight + 20;
  });

  const footerHeight = 80;
  const height = headerHeight + totalCardsHeight + footerHeight + padding * 2;

  canvas.width = width * 2; // Alta resolución (2x Retinal)
  canvas.height = height * 2;
  ctx.scale(2, 2);

  // Fondo principal
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, width, height);

  // Encabezado
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('Tiquea', padding, padding + 30);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '14px sans-serif';
  ctx.fillText('Resumen de Cuenta Dividida', padding, padding + 55);

  const totalGeneral = results.reduce((sum, p) => sum + p.totalCents, 0);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Total: ${formatCurrency(totalGeneral)}`, width - padding, padding + 35);
  ctx.textAlign = 'left';

  // Línea divisora
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, headerHeight);
  ctx.lineTo(width - padding, headerHeight);
  ctx.stroke();

  // Tarjetas de Personas
  let currentY = headerHeight + 20;

  results.forEach((p) => {
    const cardHeight = 50 + Math.max(1, p.items.length) * itemHeight;

    // Fondo tarjeta
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.roundRect(padding, currentY, width - padding * 2, cardHeight, 16);
    ctx.fill();

    // Nombre y Total
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`👤 ${p.personName}`, padding + 20, currentY + 32);

    ctx.fillStyle = '#34d399';
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(p.totalCents), width - padding - 20, currentY + 32);
    ctx.textAlign = 'left';

    // Desglose de ítems
    let itemY = currentY + 60;
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#a1a1aa';

    if (p.items.length === 0) {
      ctx.fillText('Sin consumos asignados', padding + 20, itemY);
    } else {
      p.items.forEach((it) => {
        const itemLabel = it.sharedWith > 1 ? `${it.name} (1/${it.sharedWith})` : it.name;
        ctx.fillText(itemLabel, padding + 20, itemY);

        ctx.textAlign = 'right';
        ctx.fillText(formatCurrency(it.amountCents), width - padding - 20, itemY);
        ctx.textAlign = 'left';

        itemY += itemHeight;
      });
    }

    currentY += cardHeight + 15;
  });

  // Pie de imagen
  ctx.fillStyle = '#71717a';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Generado con Tiquea • Divide tu cuenta sin peleas', width / 2, height - 30);

  // Descargar archivo
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `Tiquea-Cuenta-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}