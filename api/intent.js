export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API not configured' });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mc-mod-builder.vercel.app',
        'X-Title': 'MC Mod Builder Intent'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b:free',
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier for a Minecraft Bedrock mod builder app.

Analyze the user message and determine if they are explicitly requesting the CREATION of a mod RIGHT NOW.

Respond with ONLY one word: "mod" or "chat"

"mod" — The user is directly instructing you to create, build, generate, or make a specific addon, entity, mob, item, block, script, or mod pack. They are giving concrete creation instructions, not just talking about mods.

"chat" — Everything else: asking questions, exploring ideas, asking "can you", "how do I", "what is", discussing mods conceptually, casual conversation, or any message that is NOT a direct creation request.

When in doubt, choose "chat".`
          },
          { role: 'user', content: message }
        ],
        temperature: 0,
        max_tokens: 5
      })
    });

    if (!response.ok) {
      return res.status(200).json({ intent: 'chat', confidence: 0 });
    }

    const data = await response.json();
    const text = (data.choices?.[0]?.message?.content || '').trim().toLowerCase();
    const intent = text.includes('mod') ? 'mod' : 'chat';

    return res.status(200).json({ intent });

  } catch (error) {
    console.error('Intent error:', error);
    return res.status(200).json({ intent: 'chat', confidence: 0 });
  }
}
