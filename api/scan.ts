import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 60,
};

function getRetryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds * 1000, 0), 8000);
    }

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.min(Math.max(retryAt - Date.now(), 0), 8000);
    }
  }

  const backoff = Math.min(1000 * 2 ** (attempt - 1), 4000);
  return backoff + Math.floor(Math.random() * 1000);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'El servicio de IA no está configurado: GEMINI_API_KEY no está activa en el servidor.',
    });
  }

  try {
    const { imageBase64 } = req.body ?? {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `
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

    // Si Gemini 3.8 Flash agota su RPD (20/20), pasa inmediatamente a Gemini 3.1 Flash Lite (500 RPD)
    const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let response: Response | null = null;
    let upstreamAborted = false;

    for (const [index, model] of models.entries()) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 24000);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
          }),
        });
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'AbortError') {
          throw error;
        }
        upstreamAborted = true;
        if (index === models.length - 1) break;
        continue;
      } finally {
        clearTimeout(timeoutId);
      }

      if (response && response.ok) break;

      const responseText = response ? await response.clone().text() : '';
      const isQuotaOrServerIssue =
        response?.status === 429 ||
        response?.status === 503 ||
        (response?.status === 403 && /RESOURCE_EXHAUSTED|quota/i.test(responseText));

      const canFallback = index < models.length - 1 && isQuotaOrServerIssue;
      if (!canFallback) break;

      await new Promise((resolve) => setTimeout(resolve, getRetryDelay(response!, index + 1)));
    }

    if (!response || !response.ok) {
      if (response?.status === 429) {
        return res.status(429).json({
          error: 'Gemini alcanzó temporalmente su límite de cuota. Espera unos momentos e intenta de nuevo.',
        });
      }
      if (response?.status === 503) {
        return res.status(503).json({
          error: 'El servicio de IA está temporalmente saturado. Espera unos segundos y vuelve a intentar.',
        });
      }
      if (upstreamAborted) {
        return res.status(504).json({
          error: 'Los modelos de IA tardaron demasiado en responder. Intenta de nuevo en unos segundos.',
        });
      }
      const errText = await response?.text();
      throw new Error(`Error en la API de Gemini: ${errText || 'Sin respuesta'}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const jsonString = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(jsonString);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('Error en /api/scan:', error);
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || /operation was aborted|aborted/i.test(error.message))
    ) {
      return res.status(504).json({
        error: 'El servicio de IA interrumpió la solicitud antes de terminar. Intenta escanear el ticket de nuevo.',
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error al procesar la imagen.',
    });
  }
}
