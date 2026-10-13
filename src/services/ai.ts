import { z } from 'zod';
import type { AIProvider } from '../app/types';

export const ReceiptItemSchema = z.object({
  name: z.string().min(1).trim(),
  price: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional().default(1.0),
});

export const ScannedReceiptSchema = z.object({
  items: z.array(ReceiptItemSchema).default([]),
  total: z.number().nonnegative().optional(),
});

export type ValidatedReceipt = z.infer<typeof ScannedReceiptSchema>;

export async function scanReceiptWithAI(
  _provider: AIProvider,
  _apiKey: string,
  base64Image: string
): Promise<ValidatedReceipt> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({ imageBase64: base64Image }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const serverMessage = typeof errorData?.error === 'string' ? errorData.error : '';
      const message = /operation was aborted|aborted/i.test(serverMessage)
        ? 'El servicio de IA interrumpió la solicitud antes de terminar. Intenta escanear el ticket de nuevo.'
        : serverMessage || `Error en el servidor de escaneo (HTTP ${response.status})`;
      throw new Error(message);
    }

    const data = await response.json();
    const validated = ScannedReceiptSchema.parse(data);

    return {
      items: validated.items.filter((i) => (i.confidence ?? 1) >= 0.85),
      total: validated.total,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (
      err.name === 'AbortError' ||
      (typeof err.message === 'string' && /operation was aborted|aborted/i.test(err.message))
    ) {
      throw new Error(
        'La solicitud de escaneo se interrumpió antes de terminar. Intenta de nuevo y, si persiste, revisa el estado del servicio de IA.'
      );
    }

    if (err instanceof TypeError && /fetch/i.test(err.message)) {
      throw new Error(
        'No se pudo conectar con el servicio de escaneo. Revisa tu conexión a internet o que el backend de IA esté configurado.'
      );
    }

    throw err;
  }
}