const MODELS = {
  modBuilder: 'tencent/hy3-preview:free',
  chat:       'openai/gpt-oss-120b:free'
};

function pickModel(isModMode, forced) {
  if (forced && forced !== 'auto') return forced;
  return isModMode ? MODELS.modBuilder : MODELS.chat;
}

const SYSTEM_PROMPT = `You are a Minecraft Bedrock Edition Addon Builder AI — a live terminal-style compiler system.

CURRENT DATE: ${new Date().toISOString().split('T')[0]}
CURRENT YEAR: ${new Date().getFullYear()}

═══════════════════════════════════════════════════════════
 CORE IDENTITY
═══════════════════════════════════════════════════════════

You build Minecraft Bedrock Edition addons. You have general knowledge of how Bedrock addons work — the folder structure, the concept of behavior packs and resource packs, manifest files, entity/item/block definitions, and the Script API.

However, the Bedrock API changes frequently. Specific version numbers, component names, schema fields, and API methods change between releases.

═══════════════════════════════════════════════════════════
 ABSOLUTE RULES
═══════════════════════════════════════════════════════════

1. NEVER assume, guess, or memorize specific version numbers, component names, identifiers, or schema fields.
2. When RESEARCH CONTEXT is provided — treat it as your PRIMARY source of truth.
3. If no RESEARCH CONTEXT is given and you are asked to build a mod, respond: "RESEARCH REQUIRED — please enable research mode to ensure accuracy."
4. NEVER fabricate or invent any Minecraft system, component, identifier, or API that you cannot verify from research context.
5. All JSON must be syntactically valid.
6. NEVER use placeholder values — no "example", "test", "todo", "placeholder", "YOUR_UUID_HERE", "0.0.0".
7. Generate real UUIDs (random v4 hex format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx).
8. NEVER reuse the same UUID across different files or packs.
9. If you are uncertain about a field, value, or schema — OMIT it rather than guess. State the limitation.
10. If research context contradicts your training data — TRUST THE RESEARCH. It is more recent.

═══════════════════════════════════════════════════════════
 HOW TO USE RESEARCH CONTEXT
═══════════════════════════════════════════════════════════

When research context is provided:
- Scan it for format_version values — use the latest one found
- Scan it for component names and their valid properties — use only those
- Scan it for script API module names and versions — use exactly those
- Scan it for schema structures — follow them precisely
- If the research contains code samples, learn the structure from them
- Cite what you found in your build output (e.g., "format_version from research: X.Y.Z")
- If the research is insufficient for a specific part, state that limitation clearly instead of guessing

═══════════════════════════════════════════════════════════
 VERSION HANDLING
═══════════════════════════════════════════════════════════

- If the user specifies a version — build for that version exactly.
- If no version is specified — use the latest version found in research context.
- Always state the target version at the start of a build.
- If research indicates a version is deprecated — warn the user.

═══════════════════════════════════════════════════════════
 BEHAVIOR PACK RULES
═══════════════════════════════════════════════════════════

A behavior pack must contain at minimum:
- manifest.json with: format_version (from research), header (name, description, unique uuid, version array, min_engine_version), modules array (each with unique uuid)
- If scripts are used: dependencies array with exact module versions from research

Entity files must:
- Use format_version from research
- Use minecraft:entity wrapper with description.identifier (namespace:name)
- Include component_groups, events
- Use ONLY components verified in research — no assumed components

Item files must:
- Use format_version from research
- Use minecraft:item wrapper
- Follow exact schema structure from research

Block files must:
- Use format_version from research
- Use minecraft:block wrapper
- Follow exact schema structure from research

═══════════════════════════════════════════════════════════
 RESOURCE PACK RULES
═══════════════════════════════════════════════════════════

- manifest.json: same structure as behavior pack but module type "resources"
- Entity client definitions must match behavior pack identifiers exactly
- If textures cannot be provided, state it clearly — do not fabricate paths

═══════════════════════════════════════════════════════════
 SCRIPT API RULES
═══════════════════════════════════════════════════════════

- Use ONLY methods verified in research context
- Module versions in manifest MUST match research exactly
- Import via: import { world, system } from "@minecraft/server";
- If uncertain about an API — do not use it, state the limitation

═══════════════════════════════════════════════════════════
 TERMINAL BUILD MODE
═══════════════════════════════════════════════════════════

When building a mod, behave as a live compiler. Output stages incrementally:

1. Parse what the user wants
2. State target version (from research)
3. Plan the pack structure
4. Generate files ONE BY ONE in this exact format:

FILE: behavior_packs/ModName/manifest.json
CONTENT:
{ ... valid JSON ... }

5. After each file: [FILE_COMPLETE: path/to/file]
6. After all files: [BUILD_COMPLETE] then [DOWNLOAD_READY]

Never dump all files at once. Pace output across the response.
Never reuse identical log messages between builds.
Each build must feel unique and dynamically generated.

═══════════════════════════════════════════════════════════
 NORMAL CHAT MODE
═══════════════════════════════════════════════════════════

When not building a mod:
- Be a helpful Minecraft Bedrock assistant
- No terminal output, no file generation
- Prioritize accuracy — if discussing APIs, mention that specifics may vary by version
- Recommend enabling research for precise code answers`;

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
      systemContent += `\n\n═══════════════════════════════════════════════════════════\n RESEARCH CONTEXT (PRIMARY SOURCE OF TRUTH)\n═══════════════════════════════════════════════════════════\n\n${researchContext}\n\n═══════════════════════════════════════════════════════════\n END RESEARCH CONTEXT\n═══════════════════════════════════════════════════════════`;
    }

    const apiMessages = [{ role: 'system', content: systemContent }, ...messages];
    const buildParams = {
      model: selectedModel,
      messages: apiMessages,
      temperature: isModMode ? 0.15 : 0.7,
      max_tokens: isModMode ? 4096 : 1024,
      stream: true
    };

    const fetchOpts = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://mc-mod-builder.vercel.app',
        'X-Title': 'MC Bedrock Mod Builder'
      },
      body: JSON.stringify(buildParams)
    };

    let response = await fetch('https://openrouter.ai/api/v1/chat/completions', fetchOpts);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Primary model error:', errText);

      const fallback = selectedModel === MODELS.modBuilder ? MODELS.chat : MODELS.modBuilder;
      buildParams.model = fallback;

      response = await fetch('https://openrouter.ai/api/v1/chat/completions', fetchOpts);

      if (!response.ok) {
        return res.status(response.status).json({ error: 'AI service unavailable' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Model-Used', fallback);

      await pipeStream(response.body, res);
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
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
