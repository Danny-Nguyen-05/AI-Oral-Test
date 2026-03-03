// ============================================================
// AI provider abstraction – calls Google Gemini API
// ============================================================

export async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  const model = process.env.AI_MODEL_NAME || 'gemini-3-flash-preview';

  if (!apiKey) throw new Error('AI_PROVIDER_API_KEY not configured');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || '')
    .join('')
    .trim();

  if (!content) {
    throw new Error('Gemini returned empty content');
  }

  return content;
}
