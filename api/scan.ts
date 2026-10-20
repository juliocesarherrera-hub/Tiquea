import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 60,
};

const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

const AI_PROMPT = `
  Analiza esta imagen de un ticket o recibo de compra.
  Extrae todos los artículos consumidos con su precio y el total.
  Responde ÚNICAMENTE con un objeto JSON con el siguiente formato estricto (sin bloques de código Markdown):
  {
    "items": [
      { "name": "Nombre del concepto", "price": 0.00, "confidence": 0.95 }
    ],
    "total": 0.00
  }
`;

function getGeminiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GEMINI_API_KEY;
  if (primary) keys.push(primary.trim());
  for (let i = 2; i <= 5; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && k.trim()) keys.push(k.trim());
  }
  return keys;
}

function getRetryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 3000);
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.min(Math.max(retryAt - Date.now(), 0), 3000);
  }
  return Math.min(500 * 2 ** (attempt - 1), 1500);
}

function isQuotaOrUnavailable(response: Response, responseText: string): boolean {
  return (
    response.status === 429 ||
    response.status === 503 ||
    (response.status === 403 && /RESOURCE_EXHAUSTED|quota/i.test(responseText))
  );
}

// ---------------------------------------------------------------------------
// Intenta Gemini con rotación de Claves (1, 2, 3...) y Modelos (3.8 -> 3.1 Lite)
// ---------------------------------------------------------------------------
async function requestGeminiCascade(imageBase64: string): Promise<{ data?: any; errorText?: string; timedOut?: boolean }> {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    return { errorText: 'No hay claves de GEMINI_API_KEY configuradas.' };
  }

  for (const [keyIndex, apiKey] of keys.entries()) {
    for (const [modelIndex, model] of GEMINI_MODELS.entries()) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: AI_PROMPT },
                  { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
                ],
              },
            ],
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const json = await response.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          return { data: JSON.parse(cleaned) };
        }

        const errText = await response.text();
        const quotaExceeded = isQuotaOrUnavailable(response, errText);

        if (quotaExceeded) {
          console.warn(`Gemini clave #${keyIndex + 1} (${model}) agotó cuota. Probando siguiente opción...`);
          // Si quedan modelos en esta clave, o quedan más claves, continúa el ciclo
          continue;
        }

        // Si es otro tipo de error distinto a cuota, no podemos recuperarlo en este modelo
        continue;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          console.warn(`Gemini clave #${keyIndex + 1} (${model}) dio timeout.`);
          continue;
        }
        console.warn(`Error de red con Gemini clave #${keyIndex + 1}:`, err);
        continue;
      }
    }
  }

  return { errorText: 'Todas las claves y modelos de Gemini agotaron su cuota.' };
}

// ---------------------------------------------------------------------------
// Groq con el modelo oficial activo de visión (qwen/qwen3.8-27b)
// ---------------------------------------------------------------------------
async function requestGroq(apiKey: string, imageBase64: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: AI_PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
      }),
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content ?? '';
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    }

    const err = await res.text();
    console.warn('Groq falló con:', res.status, err);
    return null;
  } catch (e) {
    clearTimeout(timeoutId);
    console.warn('Groq error:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Handler Principal
// ---------------------------------------------------------------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { imageBase64 } = req.body ?? {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // 1️⃣ Cascada Gemini (todas las claves disponibles: 3.8 Flash -> 3.1 Flash Lite)
    const geminiResult = await requestGeminiCascade(cleanBase64);
    if (geminiResult.data) {
      return res.status(200).json(geminiResult.data);
    }

    // 2️⃣ Si Gemini agotó todas las claves y modelos, entra Groq (si GROQ_API_KEY existe)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey.trim()) {
      console.warn('Intentando respaldo de emergencia con Groq...');
      const groqData = await requestGroq(groqKey.trim(), cleanBase64);
      if (groqData) {
        return res.status(200).json(groqData);
      }
    }

    return res.status(429).json({
      error: 'Todos los servicios de escaneo alcanzaron su límite temporal de cuota. Espera unos momentos e intenta de nuevo.',
    });
  } catch (error: any) {
    console.error('Error en /api/scan:', error);
    return res.status(500).json({
      error: error?.message || 'Error al procesar la imagen.',
    });
  }
}
