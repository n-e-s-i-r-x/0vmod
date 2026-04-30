export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query' });

  const apiKey = process.env.TAVILY_API_KEY;

  if (apiKey) {
    const result = await tryTavily(query, apiKey);
    if (result) return res.status(200).json(result);
  }

  const wiki = await tryWikipediaDeep(query);
  if (wiki) return res.status(200).json(wiki);

  const ddg = await tryDDG(query);
  if (ddg) return res.status(200).json(ddg);

  return res.status(200).json({ results: [], answer: null, source: 'none' });
}

async function tryTavily(query, apiKey) {
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ query, search_depth: 'advanced', include_answer: true, include_raw_content: false, max_results: 8 })
    });
    if (!r.ok) return null;
    const data = await r.json();
    return {
      results: (data.results || []).map(x => ({ title: x.title || '', url: x.url || '', snippet: x.content || '', score: x.score || 0 })),
      answer: data.answer || null,
      source: 'tavily'
    };
  } catch (e) { console.error('Tavily:', e); return null; }
}

async function tryWikipediaDeep(query) {
  try {
    const sRes = await fetch('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
      action: 'query', list: 'search', srsearch: query, format: 'json', srlimit: '5', srprop: 'snippet', origin: '*'
    }), { headers: { 'User-Agent': 'MCModBuilder/3.0' } });
    const hits = (await sRes.json())?.query?.search || [];
    if (!hits.length) return null;
    const results = [];
    for (const hit of hits.slice(0, 4)) {
      try {
        const eRes = await fetch('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
          action: 'query', prop: 'extracts|info', exintro: 'true', explaintext: 'true',
          titles: hit.title, format: 'json', inprop: 'url', origin: '*'
        }), { headers: { 'User-Agent': 'MCModBuilder/3.0' } });
        const page = Object.values((await eRes.json())?.query?.pages || {})[0];
        if (page?.extract?.length > 50) {
          results.push({ title: page.title, url: page.fullurl || '', snippet: page.extract.replace(/\n{2,}/g, '\n').trim().slice(0, 600) });
        }
      } catch (_) {}
    }
    return results.length ? { results, answer: null, source: 'wikipedia' } : null;
  } catch (e) { console.error('Wiki:', e); return null; }
}

async function tryDDG(query) {
  try {
    const r = await fetch('https://api.duckduckgo.com/?' + new URLSearchParams({
      q: query, format: 'json', no_redirect: '1', no_html: '1', skip_disambig: '1'
    }), { headers: { 'User-Agent': 'Mozilla/5.0 MCModBuilder/3.0' } });
    const data = await r.json();
    const results = [];
    let answer = null;
    if (data.Answer) answer = data.Answer;
    if (data.AbstractText?.length > 30) results.push({ title: data.Heading || query, url: data.AbstractURL || '', snippet: data.AbstractText.slice(0, 500) });
    for (const t of (data.RelatedTopics || [])) { if (results.length >= 4) break; if (t.Text?.length > 20 && t.FirstURL) results.push({ title: t.Text.split(' - ')[0].slice(0, 80), url: t.FirstURL, snippet: t.Text.slice(0, 300) }); }
    return (results.length || answer) ? { results, answer, source: 'ddg' } : null;
  } catch (e) { console.error('DDG:', e); return null; }
}
