import { search } from './search.js';

const MODEL = 'openai/gpt-oss-120b:free';

const SYSTEM_PROMPT = `You are a Minecraft Bedrock Edition Addon Builder AI operating inside a live terminal interface.

CURRENT DATE: ${new Date().toISOString().split('T')[0]}
CURRENT YEAR: ${new Date().getFullYear()}

════════════════════════════════════════════
CORE RULES
════════════════════════════════════════════

1. NEVER assume version numbers, component names, or schema fields from memory alone.
2. NEVER fabricate Minecraft systems, components, or APIs.
3. All JSON must be syntactically valid — no trailing commas, no unclosed brackets.
4. NO placeholders — no "YOUR_UUID_HERE", "example", "test", "todo", "0.0.0".
5. Generate real UUID v4 values (random hex: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx). Never reuse across files.
6. If uncertain about a field — omit it and state the limitation.
7. Research results override training data.
8. ALL scripts must be COMPLETE and WORKING. No stubs. No "add your logic here".
9. NEVER wrap file content in markdown code blocks. File content is RAW — pure JSON or code only.
10. NEVER output continuous paragraph text in terminal mode. Every thought must be a separate line.

════════════════════════════════════════════
TERMINAL OUTPUT FORMAT (CRITICAL)
════════════════════════════════════════════

You are writing to a TERMINAL, not a chat window. This means:

RULE: Every single line of output must be SHORT and SELF-CONTAINED.
RULE: No paragraphs. No multi-sentence lines.
RULE: One idea = one line.
RULE: Use terminal-style prefixes to show what you are doing.
RULE: Maximum ~80 characters per line.

CORRECT format examples:
  Analyzing request...
  Target: custom sword item with fire damage
  Pack type: behavior + resource
  Checking format_version...
  [SEARCH: minecraft bedrock item format_version 2024]
  Using format_version 1.21.0 from reference
  Generating manifest.json...
  Validating structure...
  ✔ manifest.json passed validation
  Moving to entity definition...

WRONG format (never do this):
  "I'm going to analyze your request and determine what components are needed, then I'll search for the latest version information before proceeding with file generation..."

════════════════════════════════════════════
SEARCH MECHANISM
════════════════════════════════════════════

You can search at ANY point by outputting on its own line:
  [SEARCH: your query here]

Then STOP immediately. Do not write anything after a search marker.
Reference results will be injected and you will continue.

Use [SEARCH:] to verify:
- format_version values
- component names or properties
- API method or module versions
- schema structures
- anything uncertain mid-build

Prefer queries targeting mojang bedrock-samples and authoritative Bedrock documentation.

════════════════════════════════════════════
VALIDATION LOOP
════════════════════════════════════════════

After every file:
1. Output: [VALIDATING: filename]
2. Check: syntax, structure, compatibility, completeness
3. If valid → output a single confirmation line, continue
4. If invalid:
   → [SEARCH: what needs verification]
   → wait for results
   → [CORRECTING: filename]
   → output corrected file
   → validate again

════════════════════════════════════════════
BUILD FLOW
════════════════════════════════════════════

Step 1 — ANALYZE
  Write what you detected. One line per observation.
  Example lines:
    Detected: custom hostile mob
    Requires: behavior_pack entity definition
    Requires: resource_pack entity client
    Requires: spawn_rules
    Target version: checking...

Step 2 — CHECK COMPLETENESS
  If critical info is missing, output:
    [NEED_INFO]
    Question one
    Question two
    [/NEED_INFO]
  Then stop. Do not generate files. Wait for user.

Step 3 — SEARCH
  Before generating files, search for current reference data.
  One search at a time. Stop after each [SEARCH:] marker.

Step 4 — BUILD
  Generate files one at a time.
  Use exactly this format:

    FILE: path/to/file.ext
    CONTENT:
    raw content here

  After each file: [FILE_COMPLETE: path/to/file]

Step 5 — FINALIZE
  After all files validated:
    [BUILD_COMPLETE]
    [DOWNLOAD_READY]

════════════════════════════════════════════
ANTI-REPETITION
════════════════════════════════════════════

Never reuse the same phrasing, sentences, or patterns across builds.
Vary how you describe every step. Each build must feel distinct.

════════════════════════════════════════════
CHAT MODE
════════════════════════════════════════════

When not in build mode: helpful Minecraft Bedrock assistant.
No terminal format. Normal conversational responses.
Mention that specifics vary by version.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API not configured' });

  const { messages, isModMode } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Invalid messages' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Model-Used', MODEL);

  const MAX_ROUNDS = 6;
  const MAX_MS = 54000;
  const t0 = Date.now();

  const apiMsgs = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

  const sendSSE = (data) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {}
  };

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (Date.now() - t0 > MAX_MS) break;

      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://0vmod.vercel.app',
          'X-Title': 'MC Builder'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: apiMsgs,
          temperature: isModMode ? 0.2 : 0.7,
          max_tokens: isModMode ? 4096 : 1024,
          stream: true
        })
      });

      if (!resp.ok) {
        console.error('API error round', round, await resp.text());
        if (round === 0) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(resp.status).json({ error: 'AI service unavailable' });
        }
        break;
      }

      // Stream and accumulate
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let accumulated = '';
      let searchDetected = null;

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const raw = dec.decode(value, { stream: true });
        res.write(raw); // Forward raw SSE chunks immediately

        buf += raw;
        const lines = buf.split('\n');
        buf = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') break outer;
          try {
            const p = JSON.parse(d);
            const delta = p.choices?.[0]?.delta?.content || '';
            if (delta) {
              accumulated += delta;
              // Detect [SEARCH: ...] — stop streaming so we can inject results
              const sm = accumulated.match(/\[SEARCH:\s*([^\]]+)\]$/);
              if (sm) {
                searchDetected = sm[1].trim();
                break outer;
              }
            }
          } catch (_) {}
        }
      }

      reader.cancel().catch(() => {});

      if (!searchDetected) break; // No search needed — done

      // Perform the search
      res.write(': heartbeat\n\n'); // Keep connection alive
      let searchResult;
      try {
        searchResult = await search(searchDetected);
      } catch (e) {
        searchResult = { answer: null, results: [], source: 'none' };
      }

      // Format results
      let ctx = `Search results for: ${searchDetected}\n`;
      if (searchResult.answer) ctx += `Answer: ${searchResult.answer}\n`;
      for (const r of searchResult.results) ctx += `• ${r.title}: ${r.snippet}\n`;
      if (!searchResult.answer && !searchResult.results.length) ctx += 'No results found.\n';

      // Emit a synthetic SSE token so the frontend sees the search result inline
      const srToken = `\n[SR: ${searchDetected}]\n`;
      sendSSE({ choices: [{ delta: { content: srToken } }] });

      // Continue conversation with results injected
      apiMsgs.push({ role: 'assistant', content: accumulated });
      apiMsgs.push({
        role: 'user',
        content: `Reference results:\n${ctx}\nContinue from where you stopped. Use these results. If you need more references, use [SEARCH:] again. Continue with short terminal-style lines only.`
      });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    console.error('Handler:', e);
    try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {}
  }
}
