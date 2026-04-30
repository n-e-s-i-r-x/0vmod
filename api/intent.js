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
        'HTTP-Referer': 'https://mc-mod-builder.vercel.app',
        'X-Title': 'MC Intent'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b:free',
        messages: [
          { role: 'system', content: 'Classify the user message. If they are directly instructing creation of a Minecraft Bedrock mod, addon, entity, mob, item, block, script, or pack — respond "mod". Everything else (questions, discussion, "can you", "how to", ideas, chat) — respond "chat". One word only.' },
          { role: 'user', content: message }
        ],
        temperature: 0,
        max_tokens: 1
      })
    });
    if (!r.ok) return res.status(200).json({ intent: 'chat' });
    const d = await r.json();
    const t = (d.choices?.[0]?.message?.content || '').trim().toLowerCase();
    return res.status(200).json({ intent: t.includes('mod') ? 'mod' : 'chat' });
  } catch (e) {
    return res.status(200).json({ intent: 'chat' });
  }
}
