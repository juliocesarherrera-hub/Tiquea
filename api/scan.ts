import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 60,
};

// ---------------------------------------------------------------------------
// Modelos Gemini a intentar en orden (del más potente al más ligero)
// ---------------------------------------------------------------------------
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

// ---------------------------------------------------------------------------
// Prompt compartido por todos los proveedores
// ---------------------------------------------------------------------------
const AI_PROMPT = `Analiza esta imagen de un ticket o recibo de compra.
Extrae SOLO los artículos o platillos consumidos con su precio unitario y el total final.
Ignora líneas de pago (efectivo, cambio, tarjeta), impuestos desglosados, descuentos y propinas.
Devuelve ÚNICAMENTE un objeto JSON con este formato exacto (sin bloques de código Markdown):
{
  "items": [
    { "name": "Nombre del concepto", "price": 0.00, "confidence": 0.95 }
  ],
  "total": 0.00
}`;

// ---------------------------------------------------------------------------
// Pool de claves Gemini: lee GEMINI_API_KEY + GEMINI_API_KEY_2 … _5
// ---------------------------------------------------------------------------
function getGeminiKeys(): string[] {
  const keys: string[] = [];
  const primary = process.env.GEMINI_API_KEY;
  if (primary) keys.push(primary);
  for (let i = 2; i <= 5; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface ProviderResult {
  response?: Response;
  timedOut: boolean;
  networkError?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers de cuota y reintentos
// ---------------------------------------------------------------------------
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
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 1500);
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.min(Math.max(retryAt - Date.now(), 0), 1500);
  }
  return Math.min(500 * 2 ** (attempt - 1), 1000);
}

// ---------------------------------------------------------------------------
// Gemini: intenta cada modelo con una clave dada
// ---------------------------------------------------------------------------
async function tryGeminiKey(apiKey: string, imageBase64: string): Promise<ProviderResult> {
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
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
              ],
            },
          ],
          // Fuerza respuesta JSON nativa: evita bloques Markdown y parsing frágil
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return { timedOut: true };
      if (error instanceof TypeError) return { timedOut: false, networkError: true };
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response) break;
    if (response.ok) return { response, timedOut: false };

    const canFallbackModel =
      index < GEMINI_MODELS.length - 1 &&
      isQuotaOrUnavailable(response, await response.clone().text());
    if (!canFallbackModel) break;

    await new Promise((r) => setTimeout(r, getRetryDelay(response!, index + 1)));
  }

  return { response, timedOut: false };
}

// ---------------------------------------------------------------------------
// Gemini con pool de claves: rota a la siguiente clave si hay error de cuota
// ---------------------------------------------------------------------------
async function requestGemini(imageBase64: string): Promise<ProviderResult> {
  const keys = getGeminiKeys();
  let lastResult: ProviderResult = { timedOut: false };

  for (const [keyIndex, apiKey] of keys.entries()) {
    const result = await tryGeminiKey(apiKey, imageBase64);

    // Éxito o error no recuperable → salir inmediatamente
    if (result.response?.ok || result.timedOut || result.networkError) return result;

    const responseText = result.response ? await result.response.clone().text() : '';
    const isQuotaError = result.response
      ? isQuotaOrUnavailable(result.response, responseText)
      : false;

    lastResult = result;

    // Si es error de cuota y hay más claves, rota
    if (isQuotaError && keyIndex < keys.length - 1) {
      console.warn(`Gemini key #${keyIndex + 1} agotó cuota, rotando a la siguiente...`);
      continue;
    }

    // Error no de cuota o sin más claves
    break;
  }

  return lastResult;
}

// ---------------------------------------------------------------------------
// Groq (respaldo gratuito): llama-3.2-11b-vision-preview — 30 RPM / 7 000 RPD
// ---------------------------------------------------------------------------
async function requestGroq(apiKey: string, imageBase64: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    return await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        temperature: 0.1,
        max_tokens: 1024,
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

// ---------------------------------------------------------------------------
// OpenAI (respaldo final, requiere saldo en cuenta)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Extractores de contenido por proveedor
// ---------------------------------------------------------------------------
function extractGeminiContent(data: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function extractOpenAICompatibleContent(data: {
  choices?: Array<{ message?: { content?: string } }>;
}): string {
  return data.choices?.[0]?.message?.content ?? '';
}

function parseModelJson(rawText: string): unknown {
  // Con Structured Outputs de Gemini ya llega JSON limpio,
  // pero mantenemos la limpieza como defensa ante otros proveedores
  const jsonString = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(jsonString);
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------
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

    const geminiKeys = getGeminiKeys();
    const groqApiKey = process.env.GROQ_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (geminiKeys.length === 0 && !groqApiKey && !openaiApiKey) {
      return res.status(500).json({
        error:
          'El servicio de IA no está configurado. Añade GEMINI_API_KEY, GROQ_API_KEY o OPENAI_API_KEY en las variables de entorno del servidor.',
      });
    }

    // ------------------------------------------------------------------
    // 1️⃣  GEMINI — pool de hasta 5 claves con rotación automática
    // ------------------------------------------------------------------
    if (geminiKeys.length > 0) {
      const geminiResult = await requestGemini(cleanBase64);

      if (geminiResult.response?.ok) {
        const data = await geminiResult.response.json();
        return res.status(200).json(parseModelJson(extractGeminiContent(data)));
      }

      const responseText = geminiResult.response
        ? await geminiResult.response.clone().text()
        : '';
      const geminiExhausted =
        !geminiResult.response ||
        geminiResult.timedOut ||
        geminiResult.networkError ||
        isQuotaOrUnavailable(geminiResult.response, responseText);

      if (!geminiExhausted) {
        throw new Error(
          `Error en la API de Gemini: ${responseText || 'No se recibió respuesta.'}`
        );
      }

      console.warn('Gemini agotó todas las claves/cuotas. Intentando proveedor de respaldo...');
    }

    // ------------------------------------------------------------------
    // 2️⃣  GROQ — respaldo gratuito (llama-3.2-11b-vision-preview)
    // ------------------------------------------------------------------
    if (groqApiKey) {
      const groqResponse = await requestGroq(groqApiKey, cleanBase64);

      if (groqResponse.ok) {
        const data = await groqResponse.json();
        return res.status(200).json(parseModelJson(extractOpenAICompatibleContent(data)));
      }

      const groqError = await groqResponse.text();
      console.warn(`Groq falló (${groqResponse.status}): ${groqError}`);
    }

    // ------------------------------------------------------------------
    // 3️⃣  OPENAI — último respaldo (requiere saldo en cuenta)
    // ------------------------------------------------------------------
    if (openaiApiKey) {
      const openaiResponse = await requestOpenAI(openaiApiKey, cleanBase64);

      if (openaiResponse.ok) {
        const data = await openaiResponse.json();
        return res.status(200).json(parseModelJson(extractOpenAICompatibleContent(data)));
      }

      const errorText = await openaiResponse.text();
      console.error('Error en el respaldo de OpenAI:', openaiResponse.status, errorText);
      return res.status(502).json({
        error:
          'Todos los servicios de IA están temporalmente saturados. Intenta escanear el ticket de nuevo en unos minutos.',
      });
    }

    return res.status(429).json({
      error:
        'El servicio de escaneo está momentáneamente saturado. Intenta de nuevo en unos minutos.',
    });
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
