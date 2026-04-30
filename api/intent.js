export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(200).json({ intent: 'chat' });

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://0vmod.vercel.app',
        'X-Title': 'MC Intent'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b:free',
        messages: [
          {
            role: 'system',
            content: `Classify the user message. Reply with exactly one word.

"build" - User is directly requesting creation of a specific Minecraft Bedrock mod, addon, entity, mob, item, block, script, pack right now with enough detail to start building.
"clarify" - User mentions a mod idea but lacks enough detail, or asks if something is possible, or says things like "can you make".
"chat" - General questions, how-to, theory, anything not a direct build request.

One word only: build, clarify, or chat`
          },
          { role: 'user', content: message }
        ],
        temperature: 0,
        max_tokens: 1
      })
    });
    if (!r.ok) return res.status(200).json({ intent: 'chat' });
    const d = await r.json();
    const t = (d.choices?.[0]?.message?.content || '').trim().toLowerCase();
    return res.status(200).json({ intent: ['build', 'clarify'].includes(t) ? t : 'chat' });
  } catch (e) {
    return res.status(200).json({ intent: 'chat' });
  }
}
