export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'No message' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(200).json({ intent: 'chat' });

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mc-mod-builder.vercel.app',
        'X-Title': 'MC Intent'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b:free',
        messages: [
          {
            role: 'system',
            content: `You classify user messages for a Minecraft Bedrock mod builder app.

Determine the user's intent:

"build" — The user is directly requesting creation of a mod, addon, entity, mob, item, block, script, behavior pack, resource pack, or any concrete Minecraft Bedrock creation. They are giving instructions to build something specific right now.

"clarify" — The user is discussing a mod idea, asking questions about what's possible, exploring options, or providing partial information that suggests they might want something built but haven't given enough detail yet. They seem interested in creating something but need guidance or haven't committed to specific details.

"chat" — General conversation, questions about Minecraft, how-to questions, "can you" questions, theoretical discussions, or anything that is NOT a direct build request or mod exploration.

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
    const intent = ['build','clarify'].includes(t) ? t : 'chat';
    return res.status(200).json({ intent });
  } catch (e) {
    return res.status(200).json({ intent: 'chat' });
  }
}
