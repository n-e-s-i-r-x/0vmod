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
            content: `Classify the user message for a Minecraft Bedrock mod builder.

"build" — The user is directly and explicitly requesting creation of a specific mod, addon, entity, mob, item, block, script, behavior pack, or resource pack right now with enough detail to start.

"clarify" — The user is exploring a mod idea, asking what is possible, providing partial or vague details, asking "can you make", discussing concepts. Needs more information before building.

"chat" — General questions, how-to, theory, discussion about Minecraft, or anything not a creation request.

Respond with exactly one word: build, clarify, or chat`
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
