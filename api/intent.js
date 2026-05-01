const CLASSIFIER_MODEL = 'z-ai/glm-4.5-air:free';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(200).json({ intent: 'chat' });

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://0vmod.vercel.app',
        'X-Title': 'MC Intent Classifier'
      },
      body: JSON.stringify({
        model: CLASSIFIER_MODEL,
        messages: [
          {
            role: 'system',
            content: `Classify the user message. Reply with exactly one word only.

"build"   - User directly requests creating a specific Minecraft Bedrock addon, mod, entity, mob, item, block, or script with enough detail to start building immediately.
"clarify" - User wants to build something but lacks enough detail, asks if something is possible, or says things like "can you make" or "I want a mod that".
"chat"    - General questions, how-to explanations, theory, or anything not a direct build request.

Reply with exactly one word: build, clarify, or chat`
          },
          { role: 'user', content: message }
        ],
        temperature: 0,
        max_tokens: 5
      })
    });

    if (!r.ok) return res.status(200).json({ intent: 'chat' });

    const d = await r.json();
    const raw = (d.choices?.[0]?.message?.content || '').trim().toLowerCase();
    // Extract just the first word in case model outputs extra
    const word = raw.split(/\s+/)[0];
    const intent = ['build', 'clarify'].includes(word) ? word : 'chat';
    return res.status(200).json({ intent, model: CLASSIFIER_MODEL });
  } catch (e) {
    console.error('Intent error:', e);
    return res.status(200).json({ intent: 'chat' });
  }
}
