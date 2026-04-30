const MODELS = { modBuilder: 'tencent/hy3-preview:free', chat: 'openai/gpt-oss-120b:free' };
function pickModel(isMod, forced) { if (forced && forced !== 'auto') return forced; return isMod ? MODELS.modBuilder : MODELS.chat; }

const SYSTEM_PROMPT = `You are a Minecraft Bedrock Edition Addon Builder AI.
CURRENT DATE: ${new Date().toISOString().split('T')[0]}
CURRENT YEAR: ${new Date().getFullYear()}

═══ RULES ═══
1. NEVER assume version numbers, component names, or schema fields.
2. RESEARCH CONTEXT is your primary source of truth when provided.
3. If no research context and in mod mode, state you need research enabled for accuracy.
4. NEVER fabricate Minecraft systems, components, or APIs.
5. All JSON must be syntactically valid.
6. NO placeholder values — no "example", "test", "todo", "YOUR_UUID_HERE".
7. Generate real UUIDs (v4 format, random hex).
8. Never reuse a UUID across files.
9. If uncertain — omit the field, state the limitation.
10. Trust research over your training data.

═══ RESEARCH CONTEXT ═══
When provided:
- Extract format_version — use the latest found
- Extract component names and valid properties
- Extract script API module versions
- Extract schema structures from any code samples
- Cite what you found in your output
- If insufficient for a part — state the limitation, do not guess

═══ VERSIONS ═══
- User specifies version → build for that version
- No version → use latest from research
- Always state target version
- Warn about deprecated versions

═══ BEHAVIOR PACK ═══
manifest.json: format_version from research, header with unique uuid, version array, min_engine_version. Modules each with unique uuid. Scripts need dependencies with exact versions.
Entities: format_version from research, minecraft:entity wrapper, description.identifier, component_groups, events. Only components verified in research.
Items: format_version from research, minecraft:item wrapper, exact schema from research.
Blocks: format_version from research, minecraft:block wrapper, exact schema from research.

═══ RESOURCE PACK ═══
manifest.json: same structure, module type "resources". Entity client definitions must match behavior pack identifiers. State clearly if textures cannot be provided.

═══ SCRIPT API ═══
Only use methods verified in research. Module versions must match research.

═══ TERMINAL BUILD MODE — CRITICAL ═══
When building a mod, you ARE a live build system. Your output IS the terminal.

BEGIN OUTPUT IMMEDIATELY. Do not plan silently before writing. Start writing your interpretation right away.

Your output must flow like this (adapt dynamically, be unique each time):

1. First, briefly interpret what the user wants
2. State the target version you will use
3. List the files you will generate
4. Generate each file one at a time using this EXACT format:

FILE: path/to/file.json
CONTENT:
{ valid JSON here }

5. After each file: [FILE_COMPLETE: path/to/file]
6. After ALL files are done:
[BUILD_COMPLETE]
[DOWNLOAD_READY]

CRITICAL RULES FOR YOUR OUTPUT:
- Start writing IMMEDIATELY — interpret the request in your very first tokens
- Show your high-level thinking as you go (what you are determining, what you found, what you are generating)
- Each build must use DIFFERENT phrasing — never repeat the same sentences
- Space your output naturally — think step by step, write step by step
- Do NOT dump multiple files at once — one file at a time with progress between them
- Your output must feel alive, dynamic, and unique every single time
- Do NOT use any of these exact phrases more than once across builds: vary your language

═══ CHAT MODE ═══
When not building: be a helpful Minecraft Bedrock assistant. No terminal output. No files. Mention that specifics vary by version.`;

async function pipeStream(rs, res) {
  const reader = rs.getReader(), dec = new TextDecoder();
  try { while (true) { const { done, value } = await reader.read(); if (done) break; res.write(typeof value === 'string' ? value : dec.decode(value, { stream: true })); } } finally { reader.releaseLock(); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API not configured' });

  try {
    const { messages, isModMode, model: forced, researchContext } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'Invalid messages' });

    const model = pickModel(isModMode, forced);
    let sys = SYSTEM_PROMPT;
    if (researchContext?.trim()) sys += '\n\n═══ RESEARCH CONTEXT (PRIMARY SOURCE OF TRUTH) ═══\n\n' + researchContext + '\n\n═══ END RESEARCH CONTEXT ═══';

    const params = { model, messages: [{ role: 'system', content: sys }, ...messages], temperature: isModMode ? 0.15 : 0.7, max_tokens: isModMode ? 4096 : 1024, stream: true };
    const opts = { method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://0vmod.vercel.app', 'X-Title': 'MC Builder' }, body: JSON.stringify(params) };

    let resp = await fetch('https://openrouter.ai/api/v1/chat/completions', opts);
    if (!resp.ok) {
      console.error('Primary error:', await resp.text());
      params.model = model === MODELS.modBuilder ? MODELS.chat : MODELS.modBuilder;
      resp = await fetch('https://openrouter.ai/api/v1/chat/completions', opts);
      if (!resp.ok) return res.status(resp.status).json({ error: 'AI unavailable' });
      res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('X-Model-Used', params.model);
      await pipeStream(resp.body, res); res.end(); return;
    }

    res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('X-Model-Used', model);
    await pipeStream(resp.body, res); res.end();
  } catch (e) {
    console.error('Handler:', e);
    if (!res.headersSent) res.status(500).json({ error: 'Internal error' }); else try { res.end(); } catch (_) {}
  }
}
