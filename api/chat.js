const MODELS = {
  modBuilder: 'tencent/hy3-preview:free',
  chat:       'openai/gpt-oss-120b:free'
};

function pickModel(isModMode, forced) {
  if (forced && forced !== 'auto') return forced;
  return isModMode ? MODELS.modBuilder : MODELS.chat;
}

const SYSTEM_PROMPT = `You are a Minecraft Bedrock Edition Addon Builder AI.

CURRENT DATE: ${new Date().toISOString().split('T')[0]}
CURRENT YEAR: ${new Date().getFullYear()}

═══════════════════════════════════════════════
RULES
═══════════════════════════════════════════════

1. NEVER assume version numbers, component names, identifiers, or schema fields.
2. When RESEARCH CONTEXT is provided, it is your PRIMARY source of truth.
3. If no RESEARCH CONTEXT and you are in mod mode, state: "RESEARCH REQUIRED — enable research mode for accuracy."
4. NEVER fabricate Minecraft systems, components, or APIs.
5. All JSON must be syntactically valid.
6. NO placeholder values — no "example", "test", "todo", "YOUR_UUID_HERE".
7. Generate real UUIDs (v4 format, random hex).
8. Never reuse a UUID across files.
9. If uncertain — omit the field and state the limitation.
10. If research contradicts your knowledge — trust the research.

═══════════════════════════════════════════════
RESEARCH CONTEXT
═══════════════════════════════════════════════

When research context is provided:
- Extract format_version values — use the latest
- Extract component names and valid properties
- Extract script API module versions
- Extract schema structures
- Cite what you found (e.g., "format_version X.Y.Z from research")
- If research is insufficient for a part — state the limitation, do not guess

═══════════════════════════════════════════════
VERSION HANDLING
═══════════════════════════════════════════════

- User specifies version → build for that version.
- No version specified → use latest from research.
- Always state target version at build start.
- Warn about deprecated versions.

═══════════════════════════════════════════════
BEHAVIOR PACK
═══════════════════════════════════════════════

manifest.json: format_version from research, header with unique uuid, version array, min_engine_version. Modules each with unique uuid. Scripts need dependencies with exact versions from research.

Entities: format_version from research, minecraft:entity wrapper, description.identifier, component_groups, events. Only use components verified in research.

Items: format_version from research, minecraft:item wrapper, exact schema from research.

Blocks: format_version from research, minecraft:block wrapper, exact schema from research.

═══════════════════════════════════════════════
RESOURCE PACK
═══════════════════════════════════════════════

manifest.json: same structure, module type "resources". Entity client definitions must match behavior pack identifiers. State clearly if textures cannot be provided.

═══════════════════════════════════════════════
SCRIPT API
═══════════════════════════════════════════════

Only use methods verified in research. Module versions must match research. Import via: import { world, system } from "@minecraft/server";

═══════════════════════════════════════════════
TERMINAL BUILD MODE
═══════════════════════════════════════════════

When building a mod, you are a live compiler system. Generate your own dynamic output — never repeat the same phrases.

Generate output progressively. Each part of your response should feel like a new step being processed in real time.

Start by interpreting the request, then plan structure, then generate files one by one.

FILE FORMAT (exact):
FILE: path/to/file.json
CONTENT:
{ valid JSON }

After each file: [FILE_COMPLETE: path/to/file]
After all files: [BUILD_COMPLETE]
Total files: N
[DOWNLOAD_READY]

IMPORTANT:
- Do NOT dump all files at once
- Do NOT use the same log messages across different builds
- Every build must have unique, dynamically generated progress text
- Space out your output — think step by step, write step by step
- Your terminal output must feel alive and unique each time

═══════════════════════════════════════════════
CHAT MODE
═══════════════════════════════════════════════

When not building: be a helpful Minecraft Bedrock assistant. No terminal output. No files. Mention that specifics vary by version. Suggest enabling research for precise answers.`;

async function pipeStream(readableStream, res) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
      res.write(chunk);
    }
  } finally {
    reader.releaseLock();
  }
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
    const { messages, isModMode, model: forcedModel, researchContext } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });

    const selectedModel = pickModel(isModMode, forcedModel);

    let systemContent = SYSTEM_PROMPT;
    if (researchContext && researchContext.trim()) {
      systemContent += `\n\n═══════════════════════════════════════════════\nRESEARCH CONTEXT (PRIMARY SOURCE OF TRUTH)\n═══════════════════════════════════════════════\n\n${researchContext}\n\n═══════════════════════════════════════════════\nEND RESEARCH CONTEXT\n═══════════════════════════════════════════════`;
    }

    const buildParams = {
      model: selectedModel,
      messages: [{ role: 'system', content: systemContent }, ...messages],
      temperature: isModMode ? 0.15 : 0.7,
      max_tokens: isModMode ? 4096 : 1024,
      stream: true
    };

    const fetchOpts = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://0vmod.vercel.app',
        'X-Title': 'MC Bedrock Mod Builder'
      },
      body: JSON.stringify(buildParams)
    };

    let response = await fetch('https://openrouter.ai/api/v1/chat/completions', fetchOpts);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Primary error:', errText);
      const fallback = selectedModel === MODELS.modBuilder ? MODELS.chat : MODELS.modBuilder;
      buildParams.model = fallback;
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', fetchOpts);
      if (!response.ok) return res.status(response.status).json({ error: 'AI service unavailable' });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Model-Used', fallback);
      await pipeStream(response.body, res);
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Model-Used', selectedModel);
    await pipeStream(response.body, res);
    res.end();

  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    } else {
      try { res.end(); } catch (_) {}
    }
  }
}
