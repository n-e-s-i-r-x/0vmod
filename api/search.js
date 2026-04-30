export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query' });

  const apiKey = process.env.TAVILY_API_KEY;
  if (apiKey) { const r = await tryTavily(query, apiKey); if (r) return res.status(200).json(r); }
  const w = await tryWiki(query); if (w) return res.status(200).json(w);
  const d = await tryDDG(query); if (d) return res.status(200).json(d);
  return res.status(200).json({ results: [], answer: null, source: 'none' });
}

async function tryTavily(q, k) {
  try {
    const r = await fetch('https://api.tavily.com/search', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${k}` }, body: JSON.stringify({ query: q, search_depth: 'advanced', include_answer: true, include_raw_content: false, max_results: 8 }) });
    if (!r.ok) return null; const d = await r.json();
    return { results: (d.results || []).map(x => ({ title: x.title || '', url: x.url || '', snippet: x.content || '' })), answer: d.answer || null, source: 'tavily' };
  } catch (e) { return null; }
}

async function tryWiki(q) {
  try {
    const s = await fetch('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', list: 'search', srsearch: q, format: 'json', srlimit: '4', srprop: 'snippet', origin: '*' }), { headers: { 'User-Agent': 'MCMod/3' } });
    const hits = (await s.json())?.query?.search || []; if (!hits.length) return null;
    const results = [];
    for (const h of hits.slice(0, 3)) {
      try {
        const e = await fetch('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', prop: 'extracts|info', exintro: 'true', explaintext: 'true', titles: h.title, format: 'json', inprop: 'url', origin: '*' }), { headers: { 'User-Agent': 'MCMod/3' } });
        const p = Object.values((await e.json())?.query?.pages || {})[0];
        if (p?.extract?.length > 50) results.push({ title: p.title, url: p.fullurl || '', snippet: p.extract.replace(/\n{2,}/g, '\n').trim().slice(0, 500) });
      } catch (_) {}
    }
    return results.length ? { results, answer: null, source: 'wikipedia' } : null;
  } catch (e) { return null; }
}

async function tryDDG(q) {
  try {
    const r = await fetch('https://api.duckduckgo.com/?' + new URLSearchParams({ q, format: 'json', no_redirect: '1', no_html: '1', skip_disambig: '1' }), { headers: { 'User-Agent': 'MCMod/3' } });
    const d = await r.json(); const results = []; let answer = null;
    if (d.Answer) answer = d.Answer;
    if (d.AbstractText?.length > 30) results.push({ title: d.Heading || q, url: d.AbstractURL || '', snippet: d.AbstractText.slice(0, 400) });
    for (const t of (d.RelatedTopics || [])) { if (results.length >= 4) break; if (t.Text?.length > 20 && t.FirstURL) results.push({ title: t.Text.split(' - ')[0].slice(0, 70), url: t.FirstURL, snippet: t.Text.slice(0, 250) }); }
    return (results.length || answer) ? { results, answer, source: 'ddg' } : null;
  } catch (e) { return null; }
}
