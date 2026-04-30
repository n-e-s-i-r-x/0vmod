export async function search(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (apiKey) {
    try {
      const r = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ query, search_depth: 'advanced', include_answer: true, max_results: 6 })
      });
      if (r.ok) {
        const d = await r.json();
        return {
          answer: d.answer || null,
          results: (d.results || []).slice(0, 6).map(x => ({
            title: x.title || '',
            url: x.url || '',
            snippet: (x.content || '').slice(0, 500)
          })),
          source: 'tavily'
        };
      }
    } catch (e) { console.error('Tavily:', e); }
  }

  try {
    const r = await fetch(
      'https://api.duckduckgo.com/?' + new URLSearchParams({ q: query, format: 'json', no_redirect: '1', no_html: '1', skip_disambig: '1' }),
      { headers: { 'User-Agent': 'MCMod/4' } }
    );
    const d = await r.json();
    const results = [];
    if (d.AbstractText?.length > 30) results.push({ title: d.Heading || '', url: d.AbstractURL || '', snippet: d.AbstractText.slice(0, 400) });
    for (const t of (d.RelatedTopics || [])) {
      if (results.length >= 4) break;
      if (t.Text?.length > 20 && t.FirstURL) results.push({ title: t.Text.split(' - ')[0].slice(0, 80), url: t.FirstURL, snippet: t.Text.slice(0, 300) });
    }
    return { answer: d.Answer || null, results, source: 'ddg' };
  } catch (e) {
    return { answer: null, results: [], source: 'none' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query' });
  return res.status(200).json(await search(query));
}
