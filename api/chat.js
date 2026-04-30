import { search } from './search.js';

const MODEL = 'openai/gpt-oss-120b:free';

const SYSTEM_PROMPT = `You are a Minecraft Bedrock Edition Addon Builder AI. Your output flows through a terminal in real-time. Every character appears instantly to the user.

CURRENT DATE: ${new Date().toISOString().split('T')[0]}
CURRENT YEAR: ${new Date().getFullYear()}

═══ RULES ═══
1. NEVER assume version numbers, component names, identifiers, or schema fields from memory.
2. When reference results are provided — they are your PRIMARY source of truth.
3. NEVER fabricate Minecraft systems, components, or APIs.
4. All JSON must be syntactically valid — no trailing commas, no missing brackets.
5. NO placeholders — no "example", "test", "todo", "YOUR_UUID_HERE", "0.0.0".
6. Generate real UUIDs v4 (random hex: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx). Never reuse across files.
7. If uncertain about a field — omit it and state the limitation.
8. Reference results override your training data always.
9. ALL scripts must be COMPLETE and WORKING. No stubs. No "add your logic here". Every script ready to use as-is.
10. NEVER wrap file content in markdown code blocks. File content must be RAW — pure JSON or pure code.

═══ ANTI-REPETITION (CRITICAL) ═══
Never reuse the same phrases, sentences, or patterns across different builds. Every build must use entirely different wording for every aspect — how you interpret, announce, describe, confirm, and complete. Vary everything. Each build must feel unique and alive.

═══ SEARCH MECHANISM (CRITICAL) ═══
You can search for reference information at ANY point during the build — not just at the start.

When you are uncertain about ANY detail:
1. Output exactly on its own line: [SEARCH: your search query here]
2. Then STOP generating immediately. Do not write anything after the search marker.
3. Reference results will be provided to you in the next message.
4. Continue generating based on those results.

Use [SEARCH:] whenever:
- You need to verify a format_version
- You are unsure about a component name or property
- You need to confirm an API method or module version
- You encounter a validation issue and need to re-check
- You want to verify a schema structure against official samples
- You are about to generate a file and need current reference data

When searching, prefer queries that target the official Mojang bedrock-samples repository and authoritative Bedrock documentation.

You may use [SEARCH:] multiple times throughout a single build. This is expected and encouraged. Do NOT try to rely on memory for technical details — search when uncertain.

═══ VALIDATION LOOP (CRITICAL) ═══
After generating each file, you MUST validate it:

1. Generate the file
2. Output: [VALIDATING: filename]
3. Check:
   - Syntax: is the JSON/JS valid? No trailing commas, no missing brackets, no unclosed strings?
   - Structure: does it follow correct Bedrock schema? Correct wrapper (minecraft:entity, minecraft:item, etc.)?
   - Compatibility: are all components, identifiers, and versions valid according to reference data?
   - Completeness: any placeholder values? Missing required fields?
4. If valid → note the result briefly in your own words, continue to next file
5. If INVALID:
   - Output: [SEARCH: what you need to verify or correct]
   - Wait for reference results
   - Output: [CORRECTING: filename]
   - Regenerate the corrected file
   - Validate again
6. Only proceed when fully valid. Unverified code must NEVER be in the final output.

═══ FLOW CONTROL ═══
1. ANALYZE — Read the user's message. Determine what they want. Write your analysis as you think.
2. CHECK COMPLETENESS — Do you have enough detail to build correctly?
   - If critical details are missing, output:
     [NEED_INFO]
     Your specific questions here
     [/NEED_INFO]
     Then STOP. Wait for user response.
   - If you have enough, proceed.
3. SEARCH — Before generating files, use [SEARCH:] to get current reference data for what you're about to build.
4. BUILD — Generate files one at a time. Between files, validate. Search again if validation fails.
5. FINALIZE — After all files validated:
   [BUILD_COMPLETE]
   [DOWNLOAD_READY]

═══ FILE FORMAT ═══
FILE: path/to/file.ext
CONTENT:
raw content here — no markdown, no code block markers, no backticks

After each file: [FILE_COMPLETE: path/to/file]

═══ OUTPUT RULES ═══
- Begin writing IMMEDIATELY — first tokens = your analysis
- Show high-level thinking as you work
- Completely different phrasing every build
- One file at a time with progress between
- File content is RAW — no markdown, no backticks, no formatting
- Alive, dynamic, unique every time

═══ CHAT MODE ═══
When not building: helpful Minecraft Bedrock assistant. No terminal. No files. Mention specifics vary by version.`;

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

  const apiMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Model-Used', MODEL);

  const startTime = Date.now();
  const MAX_TIME = 55000;
  const MAX_ROUNDS = 6;
  let rounds = 0;

  try {
    while (rounds < MAX_ROUNDS && (Date.now() - startTime) < MAX_TIME) {
      rounds++;

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
          messages: apiMessages,
          temperature: isModMode ? 0.2 : 0.7,
          max_tokens: isModMode ? 4096 : 1024,
          stream: true
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error('API error:', errText);
        if (rounds === 1) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(resp.status).json({ error: 'AI service unavailable' });
        }
        break;
      }

      // Stream and accumulate
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });

        // Forward raw SSE to client
        res.write(chunk);

        // Parse for accumulation
        buf += chunk;
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const l of lines) {
          if (!l.startsWith('data: ')) continue;
          const d = l.slice(6).trim();
          if (d === '[DONE]') continue;
          try {
            const p = JSON.parse(d);
            fullResponse += p.choices?.[0]?.delta?.content || '';
          } catch (_) {}
        }
      }

      // Check for [SEARCH: ...] markers
      const searchQueries = [];
      const sr = /\[SEARCH:\s*([^\]]+)\]/g;
      let m;
      while ((m = sr.exec(fullResponse)) !== null) {
        searchQueries.push(m[1].trim());
      }

      if (searchQueries.length === 0) break; // Done

      // Perform searches
      let searchContext = '';
      for (const query of searchQueries) {
        res.write(': searching\n\n'); // Keepalive
        const results = await search(query);
        searchContext += `\nQuery: ${query}\n`;
        if (results.answer) searchContext += `Answer: ${results.answer}\n`;
        for (const r of results.results) {
          searchContext += `- ${r.title}\n  ${r.snippet}\n`;
        }
        searchContext += '\n';
      }

      // Update conversation for continuation
      apiMessages.push({ role: 'assistant', content: fullResponse });
      apiMessages.push({
        role: 'user',
        content: `Reference results retrieved:\n${searchContext}\nContinue based on these findings. Use the information directly. Do not repeat search markers for the same queries. If still uncertain about something else, you may search again.`
      });
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (e) {
    console.error('Handler:', e);
    try { res.write('data: [DONE]\n\n'); res.end(); } catch (_) {}
  }
}
