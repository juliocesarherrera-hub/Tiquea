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

const OCR_PROMPT = `
You are a receipt OCR extraction engine.
Extract ONLY visibly present products and exact prices.

STRICT RULES:
1. Never guess prices or invent missing items.
2. Return JSON ONLY with structure:
   {
     "items": [{ "name": "Item Name", "price": 12.34, "confidence": 0.95 }],
     "total": 12.34
   }
3. Ignore IVA / tax as standalone food items.
4. Output no markdown.
`;

export async function scanReceiptWithAI(
  provider: AIProvider,
  apiKey: string,
  base64Image: string
): Promise<ValidatedReceipt> {
  const trimmedKey = apiKey.trim();

  if (!trimmedKey) {
    throw new Error('Configura tu API Key en el panel de Configuración antes de escanear.');
  }

  if (!trimmedKey.startsWith('AQ.') && !trimmedKey.startsWith('AIzaSy')) {
    throw new Error('La API Key ingresada no parece válida.');
  }

  const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

  let rawText = '';
  if (provider === 'gemini') {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(trimmedKey)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: OCR_PROMPT },
              { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } }
            ]
          }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' }
        })
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData?.error?.message || `HTTP ${res.status}`;
        throw new Error(`Error de Google Gemini: ${msg}`);
      }

      const data = await res.json();
      rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('La solicitud tardó más de 15 segundos. Revisa tu conexión a internet o la claridad de la foto.');
      }
      throw err;
    }
  } else {
    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${trimmedKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-4o',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: OCR_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } }
            ]
          }]
        })
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData?.error?.message || `HTTP ${res.status}`;
        throw new Error(`Error de OpenAI: ${msg}`);
      }

      const data = await res.json();
      rawText = data?.choices?.[0]?.message?.content ?? '';
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('La solicitud tardó demasiado. Intenta nuevamente.');
      }
      throw err;
    }
  }

  const cleanedText = rawText.trim().replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/, '');
  
  if (!cleanedText) {
    throw new Error('La Inteligencia Artificial no devolvió ningún resultado del ticket.');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanedText);
  } catch {
    throw new Error('No se pudo interpretar el resultado de la imagen.');
  }

  const validated = ScannedReceiptSchema.parse(parsedJson);

  return {
    items: validated.items.filter((i) => (i.confidence ?? 1) >= 0.85),
    total: validated.total,
  };
}