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

interface GeminiResult {
  response?: Response;
  timedOut: boolean;
  networkError?: boolean;
}

function isQuotaOrUnavailable(response: Response, responseText: string): boolean {
  return (
    response.status === 429 ||
    response.status === 503 ||
    (response.status === 403 && /RESOURCE_EXHAUSTED|quota/i.test(responseText))
  );
}

function getRetryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds * 1000, 0), 1500);
    }

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.min(Math.max(retryAt - Date.now(), 0), 1500);
    }
  }

  return Math.min(500 * 2 ** (attempt - 1), 1000);
}

async function requestGemini(apiKey: string, imageBase64: string): Promise<GeminiResult> {
  let response: Response | undefined;

  for (const [index, model] of GEMINI_MODELS.entries()) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
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
                { text: AI_PROMPT },
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { timedOut: true };
      }
      if (error instanceof TypeError) {
        return { timedOut: false, networkError: true };
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response) break;
    if (response.ok) return { response, timedOut: false };
    const currentResponse = response;

    const canRetryWithNextModel =
      index < GEMINI_MODELS.length - 1 &&
      isQuotaOrUnavailable(currentResponse, await currentResponse.clone().text());
    if (!canRetryWithNextModel) break;

    await new Promise((resolve) =>
      setTimeout(resolve, getRetryDelay(currentResponse, index + 1))
    );
  }

  return { response, timedOut: false };
}

async function requestOpenAI(apiKey: string, imageBase64: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    return await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractGeminiContent(data: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function extractOpenAIContent(data: { choices?: Array<{ message?: { content?: string } }> }): string {
  return data.choices?.[0]?.message?.content ?? '';
}

function parseModelJson(rawText: string): unknown {
  const jsonString = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(jsonString);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { imageBase64 } = req.body ?? {};
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!geminiApiKey && !openaiApiKey) {
      return res.status(500).json({
        error: 'El servicio de IA no está configurado. Añade GEMINI_API_KEY o OPENAI_API_KEY en las variables de entorno del servidor.',
      });
    }

    let geminiResult: GeminiResult | undefined;
    let shouldUseOpenAI = !geminiApiKey;

    if (geminiApiKey) {
      geminiResult = await requestGemini(geminiApiKey, cleanBase64);

      if (geminiResult.response?.ok) {
        const data = await geminiResult.response.json();
        return res.status(200).json(parseModelJson(extractGeminiContent(data)));
      }

      const retryable =
        !geminiResult.response ||
        geminiResult.timedOut ||
        geminiResult.networkError ||
        isQuotaOrUnavailable(
          geminiResult.response,
          await geminiResult.response.clone().text()
        );
      shouldUseOpenAI = retryable && Boolean(openaiApiKey);

      if (!shouldUseOpenAI) {
        const quotaExceeded =
          geminiResult.response?.status === 429 ||
          (geminiResult.response?.status === 403 &&
            /RESOURCE_EXHAUSTED|quota/i.test(await geminiResult.response.clone().text()));
        if (quotaExceeded) {
          return res.status(429).json({
            error: 'Gemini alcanzó su límite de cuota y no hay un respaldo de OpenAI configurado. Añade OPENAI_API_KEY para activar el respaldo automático.',
          });
        }
        if (geminiResult.response?.status === 503) {
          return res.status(503).json({
            error: 'El servicio de Gemini está temporalmente saturado y no hay un respaldo de OpenAI configurado.',
          });
        }
        if (geminiResult.timedOut) {
          return res.status(504).json({
            error: 'Gemini tardó demasiado en responder y no hay un respaldo de OpenAI configurado.',
          });
        }

        const errText = await geminiResult.response?.text();
        throw new Error(`Error en la API de Gemini: ${errText || 'No se recibió respuesta.'}`);
      }
    }

    if (shouldUseOpenAI && openaiApiKey) {
      const response = await requestOpenAI(openaiApiKey, cleanBase64);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error en el respaldo de OpenAI:', response.status, errorText);
        return res.status(502).json({
          error: 'Gemini no estaba disponible y el servicio de respaldo de OpenAI tampoco pudo procesar el ticket. Intenta de nuevo más tarde.',
        });
      }

      const data = await response.json();
      return res.status(200).json(parseModelJson(extractOpenAIContent(data)));
    }

    return res.status(500).json({ error: 'No hay un servicio de IA disponible.' });
  } catch (error) {
    console.error('Error en /api/scan:', error);
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || /operation was aborted|aborted/i.test(error.message))
    ) {
      return res.status(504).json({
        error: 'Los servicios de IA tardaron demasiado en responder. Intenta escanear el ticket de nuevo.',
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error al procesar la imagen.',
    });
  }
}
