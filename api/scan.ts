import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no está configurada en el servidor de Vercel.' });
  }

  try {
    const { imageBase64 } = req.body;
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

    // Endpoint actualizado al modelo recomendado gemini-3.8-flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en la API de Gemini: ${errText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const jsonString = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(jsonString);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('Error en /api/scan:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Error al procesar la imagen.',
    });
  }
}